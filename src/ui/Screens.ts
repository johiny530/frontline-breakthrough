import type { LevelDef } from '../data/levels';
import { endlessUnlocked, type SaveData } from '../core/Storage';
import type { EndlessRun } from '../core/endless/EndlessRun';
import { descOf, META_UPGRADES, metaCost, nameOf, type PerkDef } from '../data/endless';
import { lang, t } from '../i18n';
import type { Stage } from '../core/Stage';
import { CONFIG } from '../data/config';
import { ICONS } from './icons';

type Handler = (action: string, arg: number) => void;

/** Mission code shown everywhere a stage is named, e.g. "OP-03". */
export const opCode = (index: number): string => `OP-${String(index + 1).padStart(2, '0')}`;
/** Endless sectors are labelled "SECTOR 07". */
export const sectorCode = (n: number): string => `SECTOR ${String(n).padStart(2, '0')}`;

const rarityLabel = (r: PerkDef['rarity']) => ({ common: t('一般', 'Common'), rare: t('稀有', 'Rare'), epic: t('史詩', 'Epic') })[r];

/** Localized stage name. */
export const stageName = (def: LevelDef): string => t(def.name, def.nameEn ?? def.name);

const medalBadge = (n: number) => `<span class="medals">${ICONS.medal}<b>${n}</b></span>`;

/** Owned perks as compact chips (pause screen, run summary). */
function perkChips(run: EndlessRun): string {
  const owned = run.owned();
  if (!owned.length) return `<p class="muted">${t('尚未取得強化', 'No perks yet')}</p>`;
  return `<ul class="chips">${owned.map(({ perk, level }) =>
    `<li class="chip r-${perk.rarity}">${nameOf(perk)}${perk.maxLevel > 1 ? ` <b>${level}</b>` : ''}</li>`).join('')}</ul>`;
}

const logo = () => `
  <h1 class="logo">
    <span class="logo-top">FRONTLINE</span>
    <span class="logo-band"><span>BREAKTHROUGH</span></span>
  </h1>
  ${lang === 'zh' ? '<p class="logo-zh">前線突破</p>' : ''}`;

/** Full-screen overlays: loading, mission select, pause, results. */
export class Screens {
  private el = document.createElement('div');
  private logoTaps = 0;
  private lastLogoTap = -Infinity;

  constructor(parent: HTMLElement, private onAction: Handler) {
    this.el.className = 'screen hidden';
    parent.appendChild(this.el);
    // pointerdown, not click: the drag input captures the pointer, which retargets clicks.
    this.el.addEventListener('pointerdown', (e) => {
      // Undocumented test entry: tap the logo 7 times, less than 1.5 s apart, to open endless mode.
      if ((e.target as HTMLElement).closest('.logo')) {
        const now = performance.now();
        this.logoTaps = now - this.lastLogoTap < 1500 ? this.logoTaps + 1 : 1;
        this.lastLogoTap = now;
        if (this.logoTaps >= 7) {
          this.logoTaps = 0;
          this.onAction('testEndless', 0);
        }
      }
    });
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
      <header class="brand">${logo()}</header>
      <div class="loadbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="loadbar-fill" style="width:${pct}%"></div>
      </div>
      <p class="loadtext">${t('部署部隊中', 'Deploying troops')} ${done}/${total}</p>
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
          ? `<span class="m-best"><small>${t('最高', 'Best')}</small>${save.best[i]}</span>`
          : `<span class="m-new">${t('待命', 'Ready')}</span>`;
      return `<li><button class="mission" data-action="play" data-arg="${i}" ${locked ? 'disabled' : ''}
          aria-label="${opCode(i)} ${stageName(lv)}${locked ? t('（未解鎖）', ' (locked)') : ''}">
        <span class="op">${opCode(i)}</span>
        <span class="m-body">
          <span class="m-name">${stageName(lv)}${lv.boss ? '<em class="tag-boss">BOSS</em>' : ''}</span>
          <span class="threat" title="${t('威脅等級', 'Threat')} ${i + 1}/5">${threat}</span>
        </span>
        ${side}
      </button></li>`;
    }).join('');
    this.show(`<div class="menu">
      <header class="brand">
        <p class="eyebrow">${t('沙漠戰區 · 作戰簡報', 'DESERT SECTOR · BRIEFING')}</p>
        ${logo()}
      </header>
      <ol class="missions">${items}</ol>
      ${this.endlessCard(save)}
      <footer class="menu-foot">
        <div class="merit"><span>${t('戰功總計', 'Total merit')}</span><b>${total}</b></div>
        <p class="keys"><kbd>←</kbd><kbd>→</kbd> ${t('或拖曳移動', 'or drag to steer')}　<kbd>Esc</kbd> ${t('暫停', 'pause')}
        <button class="lang-btn" data-action="lang" aria-label="${t('Switch to English', '切換成中文')}">${t('English', '中文')}</button></p>
      </footer>
    </div>`, 'menu');
  }

  private endlessCard(save: SaveData): string {
    if (!endlessUnlocked(save)) {
      return `<div class="endless locked">${ICONS.lock}<span><b>${t('無限作戰', 'Endless Ops')}</b><small>${t('打通 OP-05 後解鎖', 'Clear OP-05 to unlock')}</small></span></div>`;
    }
    const rec = save.endless;
    return `<div class="endless">
      <div class="endless-head">
        <span class="op">∞</span>
        <span class="m-body"><span class="m-name">${t('無限作戰', 'Endless Ops')}</span>
          <small>${t(`最遠 ${rec.sector} 段 · 最高 ${rec.score}`, `Furthest ${rec.sector} · Best ${rec.score}`)}</small></span>
        ${medalBadge(save.medals)}
      </div>
      <div class="endless-actions">
        <button class="btn btn-primary" data-action="endless">${ICONS.play}${t('出擊', 'Deploy')}</button>
        <button class="btn" data-action="shop">${ICONS.medal}${t('軍需處', 'Armory')}</button>
      </div>
    </div>`;
  }

  /** `confirmReset` shows the second, red step of the reset button. */
  shop(save: SaveData, confirmReset = false): void {
    const rows = META_UPGRADES.map((u, i) => {
      const lv = save.meta[u.id] ?? 0;
      const cost = metaCost(u, lv);
      return `<li class="upgrade">
        <div class="u-body"><b>${nameOf(u)} <span class="u-lv">Lv ${lv}</span></b><small>${descOf(u)}</small>
          <span class="u-effect">${u.effect(lv)} → ${u.effect(lv + 1)}</span></div>
        <button class="btn btn-buy btn-primary" data-action="buy" data-arg="${i}"
          ${save.medals < cost ? 'disabled' : ''}>${ICONS.medal}${cost}</button>
      </li>`;
    }).join('');
    this.show(`<div class="sheet shop">
      <p class="eyebrow">${t('無限作戰 · 永久升級', 'ENDLESS OPS · PERMANENT UPGRADES')}</p>
      <div class="shop-head"><h2 class="sheet-title">${t('軍需處', 'Armory')}</h2>${medalBadge(save.medals)}</div>
      <ul class="upgrades">${rows}</ul>
      <div class="actions">
        <button class="btn btn-primary" data-action="endless">${ICONS.play}${t('出擊', 'Deploy')}</button>
        <button class="btn" data-action="menu">${ICONS.list}${t('任務選單', 'Missions')}</button>
      </div>
      <button class="btn-reset${confirmReset ? ' armed' : ''}" data-action="${confirmReset ? 'resetConfirm' : 'resetAsk'}">
        ${confirmReset ? t('確定清除？再按一次（無法復原）', 'Sure? Tap again to erase (cannot be undone)') : t('重置無限模式進度', 'Reset endless progress')}
      </button>
    </div>`, 'dim');
  }

  /** Between sectors: pick one of three perk cards. */
  perks(run: EndlessRun, offer: PerkDef[], title: string): void {
    const cards = offer.map((p, i) => {
      const lv = run.level(p);
      return `<button class="perk r-${p.rarity}" data-action="perk" data-arg="${i}">
        <span class="perk-rarity"><kbd>${i + 1}</kbd>${rarityLabel(p.rarity)}</span>
        <span class="perk-name">${nameOf(p)}</span>
        <span class="perk-desc">${descOf(p)}</span>
        <span class="perk-level">${p.maxLevel > 1 && p.maxLevel < 99 ? `${t('等級', 'Level')} ${lv} → ${lv + 1}` : ''}</span>
      </button>`;
    }).join('');
    this.show(`<div class="perk-select">
      <p class="eyebrow">${run.sectorsCleared === 0 ? t('出擊準備', 'PRE-DEPLOYMENT') : `${sectorCode(run.sector - 1)} ${t('突破', 'CLEARED')}`} · ${t('兵力', 'ARMY')} ${run.count}</p>
      <h2 class="perk-title">${title}</h2>
      <div class="perk-cards">${cards}</div>
      <button class="btn btn-reroll" data-action="reroll" ${run.rerolls > 0 ? '' : 'disabled'}>${ICONS.retry}${t(`重抽（剩 ${run.rerolls} 次）`, `Reroll (${run.rerolls} left)`)}</button>
    </div>`, 'menu');
  }

  runOver(run: EndlessRun, earned: number, record: boolean): void {
    this.show(`<div class="sheet lost">
      <div class="stamp">${t('作戰結束', 'RUN OVER')}</div>
      <p class="eyebrow">${t('無限作戰', 'ENDLESS OPS')}</p>
      <h2 class="sheet-title">${sectorCode(run.sector)}</h2>
      <table class="ledger">
        <tr><th>${t('突破段數', 'Sectors cleared')}</th><td class="calc"></td><td>${run.sectorsCleared}</td></tr>
        <tr><th>${t('擊敗 Boss', 'Bosses killed')}</th><td class="calc"></td><td>${run.bossesKilled}</td></tr>
        <tr><th>${t('擊殺', 'Kills')}</th><td class="calc"></td><td>${run.kills}</td></tr>
        <tr class="sum"><th>${t('總戰功', 'Total merit')}</th><td class="calc"></td><td>${run.score}</td></tr>
      </table>
      ${record ? `<p class="record">${t('新紀錄', 'NEW RECORD')}</p>` : ''}
      <p class="earned">${t('獲得勳章', 'Medals earned')} ${medalBadge(earned)}</p>
      ${perkChips(run)}
      <div class="actions">
        <button class="btn btn-primary" data-action="endless">${ICONS.retry}${t('再出擊', 'Deploy again')}</button>
        <button class="btn" data-action="shop">${ICONS.medal}${t('軍需處', 'Armory')}</button>
        <button class="btn" data-action="menu">${ICONS.list}${t('任務選單', 'Missions')}</button>
      </div>
    </div>`, 'dim');
  }

  pause(st: Stage, run: EndlessRun | null = null): void {
    this.show(`<div class="sheet">
      <p class="eyebrow">${run ? `${t('無限作戰', 'ENDLESS OPS')} · ${sectorCode(run.sector)}` : `${opCode(st.index)} · ${stageName(st.def)}`}</p>
      <h2 class="sheet-title">${t('暫停', 'Paused')}</h2>
      ${run ? perkChips(run) : ''}
      <div class="actions">
        <button class="btn btn-primary" data-action="resume">${ICONS.play}${t('繼續作戰', 'Resume')}</button>
        <button class="btn" data-action="retry">${ICONS.retry}${t('重新開始', 'Restart')}</button>
        <button class="btn" data-action="menu">${ICONS.list}${t('任務選單', 'Missions')}</button>
      </div>
    </div>`, 'dim');
  }

  result(st: Stage, isBest: boolean, hasNext: boolean): void {
    const won = st.status === 'won';
    const s = st.score;
    const body = won
      ? `<table class="ledger">
          <tr><th>${t('擊殺', 'Kills')}</th><td class="calc">${s.kills} × ${CONFIG.score.kill}</td><td>${s.kills * CONFIG.score.kill}</td></tr>
          <tr><th>${t('打爆木桶', 'Barrels')}</th><td class="calc"></td><td>${s.barrelPoints}</td></tr>
          <tr><th>${t('生還士兵', 'Survivors')}</th><td class="calc">${st.squad.count} × ${CONFIG.score.survivor}</td><td>${s.survivorBonus}</td></tr>
          <tr class="sum"><th>${t('本關戰功', 'Mission merit')}</th><td class="calc"></td><td>${st.total}</td></tr>
        </table>
        ${isBest ? `<p class="record">${t('新紀錄', 'NEW RECORD')}</p>` : ''}`
      : `<p class="debrief">${t(`部隊全數陣亡，擊殺 ${s.kills} 隻殭屍。<br>多搶加兵閘門，先打爆擋路的木桶。`, `Your squad was wiped out after ${s.kills} kills.<br>Grab more troop gates and break the barrels in your way.`)}</p>`;
    const next = won && hasNext
      ? `<button class="btn btn-primary" data-action="play" data-arg="${st.index + 1}">${ICONS.play}${t('下一個任務', 'Next mission')} ${opCode(st.index + 1)}</button>`
      : '';
    const retry = `<button class="btn${next ? '' : ' btn-primary'}" data-action="retry">${ICONS.retry}${t('再打一次', 'Try again')}</button>`;
    this.show(`<div class="sheet ${won ? 'won' : 'lost'}">
      <div class="stamp">${won ? t('任務完成', 'COMPLETE') : t('任務失敗', 'FAILED')}</div>
      <p class="eyebrow">${opCode(st.index)} · ${stageName(st.def)}</p>
      <h2 class="sheet-title">${won ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h2>
      ${body}
      <div class="actions">
        ${next}${retry}
        <button class="btn" data-action="menu">${ICONS.list}${t('任務選單', 'Missions')}</button>
      </div>
    </div>`, 'dim');
  }
}
