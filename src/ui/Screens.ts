import type { LevelDef } from '../data/levels';
import type { SaveData } from '../core/Storage';
import type { Stage } from '../core/Stage';
import { CONFIG } from '../data/config';

type Handler = (action: string, arg: number) => void;

/** Full-screen overlays: loading, stage select, pause, results. */
export class Screens {
  private el = document.createElement('div');

  constructor(parent: HTMLElement, private onAction: Handler) {
    this.el.className = 'screen hidden';
    parent.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!btn || btn.hasAttribute('disabled')) return;
      this.onAction(btn.dataset.action!, Number(btn.dataset.arg ?? 0));
    });
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  private show(html: string, dim = true): void {
    this.el.innerHTML = html;
    this.el.classList.remove('hidden');
    this.el.classList.toggle('dim', dim);
  }

  loading(done: number, total: number): void {
    this.show(`<div class="panel"><h1>Frontline<br>Breakthrough</h1><p>載入中… ${done}/${total}</p></div>`);
  }

  menu(levels: LevelDef[], save: SaveData): void {
    const total = save.best.reduce((a, b) => a + b, 0);
    const items = levels.map((lv, i) => {
      const locked = i >= save.unlocked;
      const best = save.best[i] ? `最高 ${save.best[i]}` : locked ? '🔒' : '尚未通關';
      return `<button class="stage-btn" data-action="play" data-arg="${i}" ${locked ? 'disabled' : ''}>
        <span class="stage-no">${i + 1}</span><span class="stage-name">${lv.name}${lv.boss ? ' 👹' : ''}</span>
        <span class="stage-best">${best}</span></button>`;
    }).join('');
    this.show(`<div class="panel">
      <h1>Frontline<br>Breakthrough</h1>
      <div class="stage-list">${items}</div>
      <p class="total">總分（各關最高分加總）：<b>${total}</b></p>
      <p class="hint">拖曳或按 ← → / A D 移動　Esc 暫停</p>
    </div>`);
  }

  pause(): void {
    this.show(`<div class="panel"><h2>暫停</h2>
      <button class="btn" data-action="resume">繼續</button>
      <button class="btn btn-ghost" data-action="retry">重新開始這關</button>
      <button class="btn btn-ghost" data-action="menu">選關</button></div>`);
  }

  result(st: Stage, isBest: boolean, hasNext: boolean): void {
    const won = st.status === 'won';
    const s = st.score;
    const rows = won
      ? `<table class="score-table">
          <tr><td>擊殺</td><td>${s.kills} × ${CONFIG.score.kill}</td><td>${s.kills * CONFIG.score.kill}</td></tr>
          <tr><td>打爆木桶</td><td></td><td>${s.barrelPoints}</td></tr>
          <tr><td>存活士兵</td><td>${st.squad.count} × ${CONFIG.score.survivor}</td><td>${s.survivorBonus}</td></tr>
          <tr class="sum"><td>總分</td><td></td><td>${st.total}</td></tr></table>
         ${isBest ? '<p class="new-best">新紀錄！</p>' : ''}`
      : `<p>全軍覆沒，再試一次吧。</p>`;
    const next = won && hasNext ? `<button class="btn" data-action="play" data-arg="${st.index + 1}">下一關</button>` : '';
    this.show(`<div class="panel"><h2>${won ? '突破成功！' : '失敗'}</h2>${rows}
      ${next}
      <button class="btn ${next ? 'btn-ghost' : ''}" data-action="retry">再玩一次</button>
      <button class="btn btn-ghost" data-action="menu">選關</button></div>`);
  }
}
