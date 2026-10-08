// Endless (roguelike) mode content: run modifiers, perk cards, permanent
// upgrades bought with medals, and the difficulty curve for generated sectors.
import { t } from '../i18n';

/** Multipliers/additions applied to one run. Identity values = no effect. */
export interface RunMods {
  fireInterval: number; // x seconds between shots (lower is faster)
  damage: number; // x bullet damage
  rangeAdd: number; // + range (units)
  spread: number; // extra bullets per shot, fanned out
  gatePower: number; // x gate gain per hit
  rescue: number; // x soldiers freed from barrels
  barrelDamage: number; // x damage dealt to barrels and crates
  bossDamage: number; // x damage dealt to the boss
  armor: number; // x soldiers lost on enemy contact (lower is better)
  sectorGrowth: number; // x army after each cleared sector
  medalGain: number; // x medals earned by the run
}

export const IDENTITY_MODS: RunMods = {
  fireInterval: 1, damage: 1, rangeAdd: 0, spread: 0, gatePower: 1,
  rescue: 1, barrelDamage: 1, bossDamage: 1, armor: 1, sectorGrowth: 1, medalGain: 1,
};

export type Rarity = 'common' | 'rare' | 'epic';

export interface PerkDef {
  id: string;
  name: string;
  desc: string; // what one level does
  en: [name: string, desc: string];
  rarity: Rarity;
  maxLevel: number;
  apply: (m: RunMods) => void; // one level
  /** One-shot effect on the army when picked, e.g. reinforcements. */
  onPick?: (count: number) => number;
}

export const PERKS: PerkDef[] = [
  { id: 'rapid', name: '速射', desc: '射擊間隔 −15%', en: ['Rapid Fire', 'Fire interval −15%'], rarity: 'common', maxLevel: 5, apply: (m) => { m.fireInterval *= 0.85; } },
  { id: 'heavy', name: '高爆彈', desc: '子彈傷害 +25%', en: ['HE Rounds', 'Bullet damage +25%'], rarity: 'common', maxLevel: 5, apply: (m) => { m.damage *= 1.25; } },
  { id: 'scope', name: '長程瞄準鏡', desc: '射程 +3', en: ['Long Scope', 'Range +3'], rarity: 'common', maxLevel: 3, apply: (m) => { m.rangeAdd += 3; } },
  { id: 'spread', name: '散射', desc: '每次射擊左右各多 1 發子彈（半傷害）', en: ['Spread Shot', '+1 bullet on each side per shot (half damage)'], rarity: 'epic', maxLevel: 3, apply: (m) => { m.spread += 1; } },
  { id: 'engineer', name: '閘門工兵', desc: '打閘門加值 +50%', en: ['Gate Engineer', 'Gate gain from shots +50%'], rarity: 'common', maxLevel: 3, apply: (m) => { m.gatePower *= 1.5; } },
  { id: 'rescue', name: '搜救隊', desc: '木桶救出的士兵 +50%', en: ['Rescue Team', 'Soldiers freed from barrels +50%'], rarity: 'rare', maxLevel: 3, apply: (m) => { m.rescue *= 1.5; } },
  { id: 'demolition', name: '爆破專家', desc: '對木桶與補給箱傷害 ×2', en: ['Demolitions Expert', 'Damage to barrels and crates ×2'], rarity: 'common', maxLevel: 2, apply: (m) => { m.barrelDamage *= 2; } },
  { id: 'hunter', name: '獵殺者', desc: '對 Boss 傷害 +50%', en: ['Hunter', 'Damage to bosses +50%'], rarity: 'rare', maxLevel: 3, apply: (m) => { m.bossDamage *= 1.5; } },
  { id: 'armor', name: '防彈衣', desc: '被殭屍碰到的損失 −20%', en: ['Body Armor', 'Losses from zombie contact −20%'], rarity: 'rare', maxLevel: 3, apply: (m) => { m.armor *= 0.8; } },
  { id: 'overdrive', name: '過載', desc: '射速 +30%、傷害 +15%', en: ['Overdrive', 'Fire rate +30%, damage +15%'], rarity: 'epic', maxLevel: 2, apply: (m) => { m.fireInterval /= 1.3; m.damage *= 1.15; } },
  { id: 'recruit', name: '戰地徵兵', desc: '每突破一段，兵力 +10%', en: ['Field Recruitment', 'Army +10% after each sector'], rarity: 'rare', maxLevel: 5, apply: (m) => { m.sectorGrowth *= 1.1; } },
  { id: 'bounty', name: '賞金獵人', desc: '本局勳章 +15%', en: ['Bounty Hunter', 'Medals this run +15%'], rarity: 'common', maxLevel: 3, apply: (m) => { m.medalGain *= 1.15; } },
  {
    id: 'reinforce', name: '增援部隊', desc: '立刻增加 30% 兵力（至少 10 人）', en: ['Reinforcements', 'Army +30% right now (at least 10)'], rarity: 'common', maxLevel: 99,
    apply: () => {}, onPick: (count) => count + Math.max(10, Math.round(count * 0.3)),
  },
];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, rare: 3, epic: 1 };

export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: string; // what each level does
  en: [name: string, desc: string];
  /** Current total effect at level lv, e.g. "傷害 ×1.40". */
  effect: (lv: number) => string;
  baseCost: number; // cost of level n+1 = baseCost * costGrowth^n
}

// Permanent upgrades have no level cap. Each level multiplies its stat, so the
// bonus grows exponentially; costs grow exponentially too. Difficulty does not
// depend on upgrades, only on how deep the run goes (see ENDLESS.pressure*).
const fmt = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(2).replace(/\.?0+$/, ''));
export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'troops', name: '預備部隊', desc: '開局兵力每級 ×1.2', en: ['Reserve Troops', 'Starting army ×1.2 per level'], effect: (lv) => t(`開局 ${troopsAt(lv)} 人`, `Start ${troopsAt(lv)}`), baseCost: 6 },
  { id: 'firepower', name: '武器改良', desc: '子彈傷害每級 ×1.12', en: ['Weapon Upgrade', 'Bullet damage ×1.12 per level'], effect: (lv) => `${t('傷害', 'Damage')} ×${fmt(1.12 ** lv)}`, baseCost: 8 },
  { id: 'drill', name: '射擊訓練', desc: '射速每級 ×1.08', en: ['Firing Drill', 'Fire rate ×1.08 per level'], effect: (lv) => `${t('射速', 'Fire rate')} ×${fmt(1.08 ** lv)}`, baseCost: 8 },
  { id: 'intel', name: '情報網', desc: '每局可重抽強化 +1 次', en: ['Intel Network', '+1 perk reroll per run'], effect: (lv) => t(`重抽 ${lv} 次`, `${lv} rerolls`), baseCost: 12 },
  { id: 'sapper', name: '工兵連', desc: '打閘門加值每級 ×1.15', en: ['Sapper Company', 'Gate gain ×1.15 per level'], effect: (lv) => `${t('閘門', 'Gates')} ×${fmt(1.15 ** lv)}`, baseCost: 10 },
  { id: 'medic', name: '醫護兵', desc: '被殭屍碰到的損失每級 ×0.92', en: ['Medics', 'Zombie contact losses ×0.92 per level'], effect: (lv) => `${t('損失', 'Losses')} ×${fmt(0.92 ** lv)}`, baseCost: 12 },
  { id: 'demolition', name: '爆破訓練', desc: '對木桶與補給箱傷害每級 ×1.15', en: ['Demolition Training', 'Barrel and crate damage ×1.15 per level'], effect: (lv) => `${t('爆破', 'Demolition')} ×${fmt(1.15 ** lv)}`, baseCost: 8 },
  { id: 'hunter', name: '反巨獸彈藥', desc: '對 Boss 傷害每級 ×1.12', en: ['Anti-Giant Ammo', 'Boss damage ×1.12 per level'], effect: (lv) => `${t('Boss 傷害', 'Boss damage')} ×${fmt(1.12 ** lv)}`, baseCost: 8 },
  { id: 'rescue', name: '搜救犬', desc: '木桶救出的士兵每級 ×1.1', en: ['Rescue Dogs', 'Soldiers freed from barrels ×1.1 per level'], effect: (lv) => `${t('救出', 'Rescued')} ×${fmt(1.1 ** lv)}`, baseCost: 10 },
  { id: 'recruit', name: '徵兵處', desc: '每突破一段，兵力每級再 ×1.03', en: ['Recruiting Office', 'Army ×1.03 per level after each sector'], effect: (lv) => `${t('每段', 'Per sector')} ×${fmt(1.03 ** lv)}`, baseCost: 14 },
  { id: 'loot', name: '戰利品', desc: '勳章收入每級 ×1.06', en: ['Spoils of War', 'Medal income ×1.06 per level'], effect: (lv) => `${t('勳章', 'Medals')} ×${fmt(1.06 ** lv)}`, baseCost: 15 },
  { id: 'vanguard', name: '先遣補給', desc: '出擊前多選 1 張強化卡', en: ['Vanguard Supplies', '+1 perk pick before deploying'], effect: (lv) => t(`開局 ${lv} 張`, `${lv} picks`), baseCost: 20 },
];

export const META_COST_GROWTH = 1.45;
export const metaCost = (u: MetaUpgradeDef, lv: number) => Math.round(u.baseCost * META_COST_GROWTH ** lv);
const troopsAt = (lv: number) => Math.round(ENDLESS.startCount * 1.2 ** lv);

/** Applies permanent upgrades to a fresh run. */
export function metaStart(levels: Record<string, number>): { mods: RunMods; startCount: number; rerolls: number; startPicks: number } {
  const lv = (id: string) => levels[id] ?? 0;
  const mods: RunMods = { ...IDENTITY_MODS };
  mods.damage *= 1.12 ** lv('firepower');
  // Fire rate beyond FIRE_RATE_CAP turns into damage, so the shot count stays sane.
  const rate = 1.08 ** lv('drill');
  mods.fireInterval /= Math.min(rate, FIRE_RATE_CAP);
  mods.damage *= Math.max(1, rate / FIRE_RATE_CAP);
  mods.gatePower *= 1.15 ** lv('sapper');
  mods.armor *= 0.92 ** lv('medic');
  mods.barrelDamage *= 1.15 ** lv('demolition');
  mods.bossDamage *= 1.12 ** lv('hunter');
  mods.rescue *= 1.1 ** lv('rescue');
  mods.sectorGrowth *= 1.03 ** lv('recruit');
  mods.medalGain *= 1.06 ** lv('loot');
  return { mods, startCount: troopsAt(lv('troops')), rerolls: lv('intel'), startPicks: lv('vanguard') };
}
const FIRE_RATE_CAP = 3;

/** Difficulty curve for generated sectors (n = 1, 2, 3, ...). */
export const ENDLESS = {
  startCount: 12,
  sectorLength: 150,
  // Pace: forward speed multiplier speedBase + speedGrowth * n, capped; gap between road events.
  speedBase: 1.35,
  speedGrowth: 0.03,
  speedMax: 1.8,
  beatSpacing: 13,
  bossEvery: 5,
  crateChance: 0.45, // chance a sector contains a supply crate
  // Medals earned per run: per sector cleared, per boss, plus sqrt(score) / scoreMedalDiv
  // (square root, because scores balloon with the army size).
  medalsPerSector: 3,
  medalsPerBoss: 5,
  scoreMedalDiv: 8,
  sectorBonus: 100, // score per cleared sector
  // Threat follows the army (A = soldiers entering the sector):
  // total enemy hp of one wave = A * pressure(n), pressure(n) = pressureBase * pressureGrowth^n.
  // Geometric, because stacked perks multiply the army's firepower too.
  pressureBase: 3,
  pressureGrowth: 1.25,
  minArmy: 12, // A never counts below this, so tiny armies still meet enemies
  waveBodies: [30, 90] as const, // zombies per wave stay in this range; hp grows instead
  barrelHp: 0.5, // x A
  barrelReward: 0.08, // x A
  gateGood: 0.25, // x A
  gateBad: 0.3, // x A
  gateMax: 0.6, // x A
  crateHp: 0.8, // x A
  bossHp: 20, // x A, +25% per boss tier
  bossDps: 0.04, // x A soldiers per second on contact
};

/** Localized name and description of a perk or permanent upgrade. */
export const nameOf = (d: { name: string; en: [string, string] }): string => t(d.name, d.en[0]);
export const descOf = (d: { desc: string; en: [string, string] }): string => t(d.desc, d.en[1]);
