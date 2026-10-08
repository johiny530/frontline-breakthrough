import { GameAudio } from '../audio/GameAudio';
import { CONFIG } from '../data/config';
import { LEVELS } from '../data/levels';
import { loadAssets } from '../render/Assets';
import { SharedView, StageView, warmUp } from '../render/StageView';
import { World } from '../render/World';
import { Hud } from '../ui/Hud';
import { ICONS } from '../ui/icons';
import { Screens, sectorCode } from '../ui/Screens';
import { META_UPGRADES, metaCost, type PerkDef } from '../data/endless';
import { EndlessRun } from './endless/EndlessRun';
import { Bot, DEBUG, simulateAll } from './Debug';
import { Input } from './Input';
import { Stage } from './Stage';
import { loadSave, writeSave, type SaveData } from './Storage';

type Mode = 'loading' | 'menu' | 'playing' | 'paused' | 'result' | 'perk';

const MAX_DT = 1 / 30;

/** Top-level state machine: menus, running a stage, results. */
export class Game {
  private mode: Mode = 'loading';
  private world!: World;
  private shared!: SharedView;
  private input: Input;
  private hud: Hud;
  private screens: Screens;
  private save: SaveData;
  private stage: Stage | null = null;
  private view: StageView | null = null;
  private bot: Bot | null = null;
  private lastTime = 0;
  private menuTime = 0;
  private hintTime = 0; // seconds the controls hint stays up
  private run: EndlessRun | null = null; // set while an endless run is active
  private offer: PerkDef[] = [];
  private audio = new GameAudio();

  constructor(private root: HTMLElement, ui: HTMLElement) {
    this.save = loadSave(LEVELS.length);
    this.input = new Input(root);
    this.input.onPause = () => this.togglePause();
    this.hud = new Hud(ui, () => this.togglePause());
    this.screens = new Screens(ui, (a, arg) => {
      this.audio.click();
      this.onAction(a, arg);
    });
    this.makeSoundToggle(ui);
    // Keyboard shortcuts on overlays: 1/2/3 pick a perk card, Enter presses the main button.
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'perk' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        const i = Number(e.code.slice(-1)) - 1;
        if (i < this.offer.length) this.onAction('perk', i);
      } else if ((this.mode === 'result' || this.mode === 'paused') && e.code === 'Enter') {
        ui.querySelector<HTMLButtonElement>('.screen .btn-primary:not([disabled])')?.click();
      }
    });
    // Leaving the tab pauses the game, so returning doesn't drop you mid-fight.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing' && !DEBUG.bot) this.togglePause();
    });
  }

  private makeSoundToggle(ui: HTMLElement): void {
    const btn = document.createElement('button');
    btn.className = 'icon-btn btn-sound';
    const render = () => {
      btn.innerHTML = this.audio.muted ? ICONS.soundOff : ICONS.soundOn;
      btn.setAttribute('aria-label', this.audio.muted ? '開啟聲音' : '關閉聲音');
    };
    btn.addEventListener('click', () => {
      this.audio.toggleMute();
      render();
    });
    render();
    ui.appendChild(btn);
  }

  async start(): Promise<void> {
    this.screens.loading(0, 1);
    // Canvas labels need the display face loaded before they are drawn.
    const fonts = document.fonts?.load('64px "Black Ops One"').catch(() => []);
    const assets = await loadAssets((d, t) => this.screens.loading(d, t));
    await fonts;
    this.world = new World(this.root, assets);
    this.shared = new SharedView(assets, this.world);
    warmUp(this.shared, this.world);
    this.world.buildTrack(60, 1);
    this.world.follow(0, 0);

    if (DEBUG.stage !== null) this.play(DEBUG.stage);
    else this.showMenu();

    this.world.renderer.setAnimationLoop((t) => this.frame(t));
  }

  get currentStage(): Stage | null {
    return this.stage;
  }

  /** Debug: play every stage headless with the bot, e.g. `__fb.simulate()` in the console. */
  simulate(): string {
    return simulateAll(LEVELS);
  }

  /** Debug: run `seconds` of game time synchronously (works in background tabs). */
  advance(seconds: number): void {
    const step = 1000 / 60;
    if (!this.lastTime) this.lastTime = performance.now();
    for (let t = 0; t < seconds * 1000; t += step) this.frame(this.lastTime + step);
  }

  private frame(timeMs: number): void {
    const raw = this.lastTime ? (timeMs - this.lastTime) / 1000 : 0;
    this.lastTime = timeMs;
    const dt = Math.min(raw, 0.1) * DEBUG.timeScale;

    if (this.mode === 'playing' && this.stage && this.view) {
      // Fixed-ish substeps keep collisions stable on slow frames.
      const steps = Math.max(1, Math.ceil(dt / MAX_DT));
      for (let i = 0; i < steps && this.stage.status === 'playing'; i++) {
        this.steer(dt / steps);
        this.stage.update(dt / steps);
      }
      if (this.run) this.handleCrates(this.stage);
      this.audio.handle(this.stage.events); // before sync() clears the queue
      this.view.sync(dt);
      this.hud.update(this.stage);
      if (this.hintTime > 0) {
        this.hintTime -= dt;
        if (this.hintTime <= 0 || Math.abs(this.stage.squad.x) > 1.2) {
          this.hintTime = 0;
          this.hud.showHint(false);
        }
      }
      if (this.stage.status !== 'playing') this.endStage();
    } else if (this.view) {
      this.view.sync(0);
    } else if (this.mode === 'menu' || this.mode === 'loading') {
      // Slow fly-over of the empty road behind the menu.
      this.menuTime += dt;
      this.world.follow(Math.sin(this.menuTime * 0.3) * 2, -((this.menuTime * 3) % 40), 2.5);
    }
    this.world.render();
  }

  private steer(dt: number): void {
    const squad = this.stage!.squad;
    if (this.bot) {
      squad.targetX = this.bot.targetX(this.stage!);
      return;
    }
    const hw = CONFIG.track.halfWidth;
    squad.targetX += this.input.consumeDrag() * hw * 2 * CONFIG.squad.dragGain;
    squad.targetX += this.input.axis * CONFIG.squad.steerSpeed * dt;
  }

  private play(index: number): void {
    this.run = null;
    this.startStage(new Stage(LEVELS[index], index));
    this.refreshPerks();
    // Teach the controls on the very first stage until it has been cleared once.
    this.hintTime = index === 0 && this.save.best[0] === 0 ? 7 : 0;
    this.hud.showHint(this.hintTime > 0);
  }

  private startEndless(): void {
    this.run = new EndlessRun(this.save.meta);
    this.startSector();
  }

  private startSector(): void {
    const run = this.run!;
    this.startStage(run.createStage(), sectorCode(run.sector), run.score);
    this.refreshPerks();
  }

  private refreshPerks(): void {
    this.hud.setPerks(this.run
      ? this.run.owned().map(({ perk, level }) => ({ name: perk.name, level, rarity: perk.rarity }))
      : []);
  }

  /** Supply crates hand out a random perk on the spot. */
  private handleCrates(st: Stage): void {
    for (const ev of st.events) {
      if (ev.type !== 'crateBreak') continue;
      const { perk, added } = this.run!.takeRandom(st.squad.count);
      st.squad.add(added, ev.barrel.x, ev.barrel.z);
      this.hud.toast(`<small>補給箱</small>${perk.name}<em>${perk.desc}</em>`);
      this.audio.perk();
      this.refreshPerks();
    }
  }

  private startStage(stage: Stage, code?: string, scoreOffset = 0): void {
    this.view?.dispose();
    this.hintTime = 0;
    this.hud.showHint(false);
    this.stage = stage;
    this.view = new StageView(this.stage, this.shared, this.world);
    // Compile shaders now so the first frame of the stage doesn't hitch.
    this.world.renderer.compile(this.world.scene, this.world.camera);
    this.bot = DEBUG.bot ? new Bot() : null;
    this.input.consumeDrag();
    this.mode = 'playing';
    this.screens.hide();
    this.hud.show(true);
    this.hud.start(this.stage, code, scoreOffset);
    this.audio.setPaused(false);
    this.audio.playTrack('stage');
  }

  private endStage(): void {
    const st = this.stage!;
    this.mode = 'result';
    this.hud.show(false);
    if (this.run) {
      this.endSector(st, this.run);
      return;
    }
    let isBest = false;
    // Bot runs are tests; keep them out of the player's records.
    if (st.status === 'won' && !this.bot) {
      isBest = st.total > this.save.best[st.index];
      if (isBest) this.save.best[st.index] = st.total;
      this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, st.index + 2));
      writeSave(this.save);
    }
    DEBUG.report(st);
    this.audio.setPaused(false);
    this.audio.result(st.status === 'won');
    this.screens.result(st, isBest, st.index + 1 < LEVELS.length);
  }

  private endSector(st: Stage, run: EndlessRun): void {
    this.audio.setPaused(false);
    if (run.finishSector(st)) {
      this.audio.result(true);
      this.showPerks();
      return;
    }
    const { earned, record } = this.settleRun(run);
    this.audio.result(false);
    this.screens.runOver(run, earned, record);
  }

  /** Pays out medals and keeps records once per run (bot runs are tests). */
  private settleRun(run: EndlessRun): { earned: number; record: boolean } {
    const earned = run.medals;
    const rec = this.save.endless;
    const record = run.sectorsCleared > rec.sector || run.score > rec.score;
    if (!run.settled && !this.bot) {
      this.save.medals += earned;
      rec.sector = Math.max(rec.sector, run.sectorsCleared);
      rec.score = Math.max(rec.score, run.score);
      writeSave(this.save);
    }
    run.settled = true;
    return { earned, record };
  }

  /** Leaving a run from the pause menu still pays for the progress made. */
  private abandonRun(): void {
    const run = this.run;
    if (!run || run.settled) return;
    if (this.mode === 'paused' && this.stage?.status === 'playing') run.finishSector(this.stage);
    this.settleRun(run);
  }

  private showPerks(): void {
    const run = this.run!;
    this.mode = 'perk';
    this.offer = run.offer();
    const title = run.pendingPicks > 1 ? `擊敗 Boss！選擇強化（還有 ${run.pendingPicks} 次）` : '選擇強化';
    this.screens.perks(run, this.offer, title);
  }

  private showShop(): void {
    this.mode = 'menu';
    this.clearStage();
    this.hud.show(false);
    this.screens.shop(this.save);
    this.audio.playTrack('menu');
  }

  private buy(index: number): void {
    const u = META_UPGRADES[index];
    const lv = this.save.meta[u.id] ?? 0;
    const cost = metaCost(u, lv);
    if (this.save.medals < cost) return;
    this.save.medals -= cost;
    this.save.meta[u.id] = lv + 1;
    writeSave(this.save);
    this.screens.shop(this.save);
  }

  /** Removes the finished stage so menus fly over an empty road. */
  private clearStage(): void {
    if (!this.view) return;
    this.view.dispose();
    this.view = null;
    this.world.buildTrack(60, 1);
  }

  private showMenu(): void {
    this.mode = 'menu';
    this.run = null;
    this.clearStage();
    this.hud.show(false);
    this.screens.menu(LEVELS, this.save);
    this.audio.setPaused(false);
    this.audio.playTrack('menu');
  }

  private togglePause(): void {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.screens.pause(this.stage!, this.run);
      this.audio.setPaused(true);
    } else if (this.mode === 'paused') {
      this.onAction('resume', 0);
    }
  }

  onAction(action: string, arg: number): void {
    switch (action) {
      case 'play': this.play(arg); break;
      case 'retry':
        if (this.run) { this.abandonRun(); this.startEndless(); }
        else if (this.stage) this.play(this.stage.index);
        break;
      case 'endless': this.startEndless(); break;
      // Secret logo taps (see Screens): starts endless even while it is locked.
      case 'testEndless': if (this.mode === 'menu') this.startEndless(); break;
      case 'shop': this.abandonRun(); this.showShop(); break;
      case 'buy': this.buy(arg); break;
      case 'resetAsk': this.screens.shop(this.save, true); break;
      case 'resetConfirm':
        // Endless data only: campaign scores stay, so endless stays unlocked.
        this.save.medals = 0;
        this.save.meta = {};
        this.save.endless = { sector: 0, score: 0 };
        writeSave(this.save);
        this.screens.shop(this.save);
        break;
      case 'perk': {
        const run = this.run!;
        run.take(this.offer[arg]);
        this.audio.perk();
        run.pendingPicks--;
        if (run.pendingPicks > 0) this.showPerks();
        else this.startSector();
        break;
      }
      case 'reroll':
        if (this.run && this.run.rerolls > 0) {
          this.run.rerolls--;
          this.showPerks();
        }
        break;
      case 'menu': this.abandonRun(); this.showMenu(); break;
      case 'resume':
        this.mode = 'playing';
        this.screens.hide();
        this.input.consumeDrag();
        this.audio.setPaused(false);
        break;
    }
  }
}
