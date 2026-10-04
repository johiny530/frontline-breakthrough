import type { Stage } from '../core/Stage';

/** In-game overlay: stage title, enemies left, score, boss health bar, pause button. */
export class Hud {
  readonly el = document.createElement('div');
  private stageEl: HTMLElement;
  private enemiesEl: HTMLElement;
  private scoreEl: HTMLElement;
  private bossBar: HTMLElement;
  private bossFill: HTMLElement;

  constructor(parent: HTMLElement, onPause: () => void) {
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-title">Frontline Breakthrough <span data-id="stage"></span></div>
      <div class="hud-row">
        <div class="pill pill-enemy"><span class="skull">☠</span><b data-id="enemies">0</b></div>
        <div class="pill pill-score">★ <b data-id="score">0</b></div>
      </div>
      <div class="bossbar hidden"><div class="bossbar-fill"></div><span>BOSS</span></div>
      <button class="btn-pause" aria-label="暫停">❚❚</button>`;
    parent.appendChild(this.el);
    const q = (id: string) => this.el.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
    this.stageEl = q('stage');
    this.enemiesEl = q('enemies');
    this.scoreEl = q('score');
    this.bossBar = this.el.querySelector('.bossbar')!;
    this.bossFill = this.el.querySelector('.bossbar-fill')!;
    this.el.querySelector('.btn-pause')!.addEventListener('click', onPause);
  }

  show(visible: boolean): void {
    this.el.classList.toggle('hidden', !visible);
  }

  update(st: Stage, stageCount: number): void {
    this.stageEl.textContent = `${st.index + 1}/${stageCount}`;
    this.enemiesEl.textContent = `${st.enemiesLeft}`;
    this.scoreEl.textContent = `${st.total}`;
    const boss = st.boss;
    this.bossBar.classList.toggle('hidden', !boss || !boss.alive);
    if (boss) this.bossFill.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
  }
}
