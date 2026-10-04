import { CONFIG } from '../data/config';
import { LEVELS } from '../data/levels';
import { loadAssets } from '../render/Assets';
import { SharedView, StageView } from '../render/StageView';
import { World } from '../render/World';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { Bot, DEBUG, simulateAll } from './Debug';
import { Input } from './Input';
import { Stage } from './Stage';
import { loadSave, writeSave, type SaveData } from './Storage';

type Mode = 'loading' | 'menu' | 'playing' | 'paused' | 'result';

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

  constructor(private root: HTMLElement, ui: HTMLElement) {
    this.save = loadSave(LEVELS.length);
    this.input = new Input(root);
    this.input.onPause = () => this.togglePause();
    this.hud = new Hud(ui, () => this.togglePause());
    this.screens = new Screens(ui, (a, arg) => this.onAction(a, arg));
  }

  async start(): Promise<void> {
    this.screens.loading(0, 1);
    const assets = await loadAssets((d, t) => this.screens.loading(d, t));
    this.world = new World(this.root, assets);
    this.shared = new SharedView(assets, this.world);
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
      this.view.sync(dt);
      this.hud.update(this.stage, LEVELS.length);
      if (this.stage.status !== 'playing') this.endStage();
    } else if (this.view) {
      this.view.sync(0);
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
    this.view?.dispose();
    this.stage = new Stage(LEVELS[index], index);
    this.view = new StageView(this.stage, this.shared, this.world);
    this.bot = DEBUG.bot ? new Bot() : null;
    this.input.consumeDrag();
    this.mode = 'playing';
    this.screens.hide();
    this.hud.show(true);
  }

  private endStage(): void {
    const st = this.stage!;
    this.mode = 'result';
    this.hud.show(false);
    let isBest = false;
    if (st.status === 'won') {
      isBest = st.total > this.save.best[st.index];
      if (isBest) this.save.best[st.index] = st.total;
      this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, st.index + 2));
      writeSave(this.save);
    }
    DEBUG.report(st);
    this.screens.result(st, isBest, st.index + 1 < LEVELS.length);
  }

  private showMenu(): void {
    this.mode = 'menu';
    this.hud.show(false);
    this.screens.menu(LEVELS, this.save);
  }

  private togglePause(): void {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.screens.pause();
    } else if (this.mode === 'paused') {
      this.onAction('resume', 0);
    }
  }

  onAction(action: string, arg: number): void {
    switch (action) {
      case 'play': this.play(arg); break;
      case 'retry': if (this.stage) this.play(this.stage.index); break;
      case 'menu': this.showMenu(); break;
      case 'resume':
        this.mode = 'playing';
        this.screens.hide();
        this.input.consumeDrag();
        break;
    }
  }
}
