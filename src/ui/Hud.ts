import type { Stage } from '../core/Stage';
import { ICONS } from './icons';
import { opCode } from './Screens';

/**
 * In-game overlay: mission tag, score, enemies left, route progress,
 * boss health, pause button, plus the mission-start and boss-warning banners.
 */
export class Hud {
  readonly el = document.createElement('div');
  private q: (id: string) => HTMLElement;
  private bossSeen = false;
  private lastScore = -1;
  private scoreOffset = 0; // endless: score from earlier sectors
  private toastTimer = 0;

  constructor(parent: HTMLElement, onPause: () => void) {
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-op"><b data-id="op"></b><span data-id="name"></span></div>
        <div class="hud-score">${ICONS.star}<b data-id="score">0</b></div>
      </div>
      <div class="hud-route">
        <div class="route-track"><div class="route-fill" data-id="route"></div></div>
        <span class="route-end" data-id="routeEnd"></span>
      </div>
      <div class="hud-enemies">${ICONS.skull}<b data-id="enemies">0</b></div>
      <div class="bossbar hidden" data-id="boss">
        <span class="bossbar-label">BOSS</span>
        <div class="bossbar-track"><div class="bossbar-fill" data-id="bossFill"></div></div>
        <b class="bossbar-hp" data-id="bossHp"></b>
      </div>
      <div class="banner hidden" data-id="banner"></div>
      <div class="toast hidden" data-id="toast"></div>
      <button class="icon-btn btn-pause" aria-label="暫停">${ICONS.pause}</button>`;
    parent.appendChild(this.el);
    this.q = (id) => this.el.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
    this.el.querySelector('.btn-pause')!.addEventListener('click', onPause);
  }

  show(visible: boolean): void {
    this.el.classList.toggle('hidden', !visible);
  }

  /** Call when a stage starts. `code` overrides the mission tag (endless sectors). */
  start(st: Stage, code = opCode(st.index), scoreOffset = 0): void {
    this.bossSeen = false;
    this.lastScore = -1;
    this.scoreOffset = scoreOffset;
    this.q('op').textContent = code;
    this.q('name').textContent = st.def.name;
    this.q('routeEnd').innerHTML = st.def.boss ? ICONS.skull : '';
    this.q('routeEnd').classList.toggle('is-boss', !!st.def.boss);
    this.banner(`<small>${code}</small>${st.def.name}<em>突破防線</em>`, 'banner-start');
  }

  update(st: Stage): void {
    this.q('enemies').textContent = `${st.enemiesLeft}`;
    const total = st.total + this.scoreOffset;
    if (total !== this.lastScore) {
      this.lastScore = total;
      const el = this.q('score');
      el.textContent = `${total}`;
      el.classList.remove('bump');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add('bump');
    }
    this.q('route').style.width = `${(st.progress / st.def.length) * 100}%`;

    const boss = st.boss;
    const bar = this.q('boss');
    bar.classList.toggle('hidden', !boss || !boss.alive);
    if (boss) {
      this.q('bossFill').style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
      this.q('bossHp').textContent = `${Math.max(0, Math.ceil(boss.hp))}`;
      if (!this.bossSeen) {
        this.bossSeen = true;
        this.banner('<small>WARNING</small>巨型殭屍接近<em>集中火力</em>', 'banner-boss');
      }
    }
  }

  /** Short notice under the HUD, e.g. a perk from a supply crate. */
  toast(html: string): void {
    const t = this.q('toast');
    t.innerHTML = html;
    t.classList.remove('hidden', 'play');
    void t.offsetWidth;
    t.classList.add('play');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.add('hidden'), 2600);
  }

  private banner(html: string, variant: string): void {
    const b = this.q('banner');
    b.innerHTML = html;
    b.className = `banner ${variant}`;
    // Replaying: force a reflow so the animation restarts.
    void b.offsetWidth;
    b.classList.add('play');
  }
}
