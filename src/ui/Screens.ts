import type { LevelDef } from '../data/levels';
import type { SaveData } from '../core/Storage';
import type { Stage } from '../core/Stage';
import { CONFIG } from '../data/config';
import { ICONS } from './icons';

type Handler = (action: string, arg: number) => void;

/** Mission code shown everywhere a stage is named, e.g. "OP-03". */
export const opCode = (index: number): string => `OP-${String(index + 1).padStart(2, '0')}`;

const LOGO = `
  <h1 class="logo">
    <span class="logo-top">FRONTLINE</span>
    <span class="logo-band"><span>BREAKTHROUGH</span></span>
  </h1>
  <p class="logo-zh">前線突破</p>`;

/** Full-screen overlays: loading, mission select, pause, results. */
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

  private show(html: string, variant: string): void {
    this.el.innerHTML = html;
    this.el.className = `screen screen-${variant}`;
  }

  loading(done: number, total: number): void {
    const pct = Math.round((done / Math.max(1, total)) * 100);
    this.show(`<div class="menu">
      <header class="brand">${LOGO}</header>
      <div class="loadbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="loadbar-fill" style="width:${pct}%"></div>
      </div>
      <p class="loadtext">部署部隊中 ${done}/${total}</p>
    </div>`, 'menu');
  }

  menu(levels: LevelDef[], save: SaveData): void {
    const total = save.best.reduce((a, b) => a + b, 0);
    const items = levels.map((lv, i) => {
      const locked = i >= save.unlocked;
      const threat = Array.from({ length: 5 }, (_, k) =>
        `<span class="pip${k <= i ? ' on' : ''}">${ICONS.chevron}</span>`).join('');
      const side = locked
        ? `<span class="m-lock">${ICONS.lock}</span>`
        : save.best[i]
          ? `<span class="m-best"><small>最高</small>${save.best[i]}</span>`
          : `<span class="m-new">待命</span>`;
      return `<li><button class="mission" data-action="play" data-arg="${i}" ${locked ? 'disabled' : ''}
          aria-label="${opCode(i)} ${lv.name}${locked ? '（未解鎖）' : ''}">
        <span class="op">${opCode(i)}</span>
        <span class="m-body">
          <span class="m-name">${lv.name}${lv.boss ? '<em class="tag-boss">BOSS</em>' : ''}</span>
          <span class="threat" title="威脅等級 ${i + 1}/5">${threat}</span>
        </span>
        ${side}
      </button></li>`;
    }).join('');
    this.show(`<div class="menu">
      <header class="brand">
        <p class="eyebrow">沙漠戰區 · 作戰簡報</p>
        ${LOGO}
      </header>
      <ol class="missions">${items}</ol>
      <footer class="menu-foot">
        <div class="merit"><span>戰功總計</span><b>${total}</b></div>
        <p class="keys"><kbd>←</kbd><kbd>→</kbd> 或拖曳移動　<kbd>Esc</kbd> 暫停</p>
      </footer>
    </div>`, 'menu');
  }

  pause(st: Stage): void {
    this.show(`<div class="sheet">
      <p class="eyebrow">${opCode(st.index)} · ${st.def.name}</p>
      <h2 class="sheet-title">暫停</h2>
      <div class="actions">
        <button class="btn btn-primary" data-action="resume">${ICONS.play}繼續作戰</button>
        <button class="btn" data-action="retry">${ICONS.retry}重新開始</button>
        <button class="btn" data-action="menu">${ICONS.list}任務選單</button>
      </div>
    </div>`, 'dim');
  }

  result(st: Stage, isBest: boolean, hasNext: boolean): void {
    const won = st.status === 'won';
    const s = st.score;
    const body = won
      ? `<table class="ledger">
          <tr><th>擊殺</th><td class="calc">${s.kills} × ${CONFIG.score.kill}</td><td>${s.kills * CONFIG.score.kill}</td></tr>
          <tr><th>打爆木桶</th><td class="calc"></td><td>${s.barrelPoints}</td></tr>
          <tr><th>生還士兵</th><td class="calc">${st.squad.count} × ${CONFIG.score.survivor}</td><td>${s.survivorBonus}</td></tr>
          <tr class="sum"><th>本關戰功</th><td class="calc"></td><td>${st.total}</td></tr>
        </table>
        ${isBest ? '<p class="record">新紀錄</p>' : ''}`
      : `<p class="debrief">部隊全數陣亡，擊殺 ${s.kills} 隻殭屍。<br>多搶加兵閘門，先打爆擋路的木桶。</p>`;
    const next = won && hasNext
      ? `<button class="btn btn-primary" data-action="play" data-arg="${st.index + 1}">${ICONS.play}下一個任務 ${opCode(st.index + 1)}</button>`
      : '';
    const retry = `<button class="btn${next ? '' : ' btn-primary'}" data-action="retry">${ICONS.retry}再打一次</button>`;
    this.show(`<div class="sheet ${won ? 'won' : 'lost'}">
      <div class="stamp">${won ? '任務完成' : '任務失敗'}</div>
      <p class="eyebrow">${opCode(st.index)} · ${st.def.name}</p>
      <h2 class="sheet-title">${won ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h2>
      ${body}
      <div class="actions">
        ${next}${retry}
        <button class="btn" data-action="menu">${ICONS.list}任務選單</button>
      </div>
    </div>`, 'dim');
  }
}
