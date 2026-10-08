// Endless (roguelike) mode content: run modifiers, perk cards, permanent
// upgrades bought with medals, and the difficulty curve for generated sectors.

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
}

export const IDENTITY_MODS: RunMods = {
  fireInterval: 1, damage: 1, rangeAdd: 0, spread: 0, gatePower: 1,
  rescue: 1, barrelDamage: 1, bossDamage: 1, armor: 1,
};

export type Rarity = 'common' | 'rare' | 'epic';

export interface PerkDef {
  id: string;
  name: string;
  desc: string; // what one level does
  rarity: Rarity;
  maxLevel: number;
  apply: (m: RunMods) => void; // one level
  /** One-shot effect on the army when picked, e.g. reinforcements. */
  onPick?: (count: number) => number;
}

export const PERKS: PerkDef[] = [
  { id: 'rapid', name: '速射', desc: '射擊間隔 −15%', rarity: 'common', maxLevel: 5, apply: (m) => { m.fireInterval *= 0.85; } },
  { id: 'heavy', name: '高爆彈', desc: '子彈傷害 +25%', rarity: 'common', maxLevel: 5, apply: (m) => { m.damage *= 1.25; } },
  { id: 'scope', name: '長程瞄準鏡', desc: '射程 +3', rarity: 'common', maxLevel: 3, apply: (m) => { m.rangeAdd += 3; } },
  { id: 'spread', name: '散射', desc: '每次射擊左右各多 1 發子彈（半傷害）', rarity: 'epic', maxLevel: 3, apply: (m) => { m.spread += 1; } },
  { id: 'engineer', name: '閘門工兵', desc: '打閘門加值 +50%', rarity: 'common', maxLevel: 3, apply: (m) => { m.gatePower *= 1.5; } },
  { id: 'rescue', name: '搜救隊', desc: '木桶救出的士兵 +50%', rarity: 'rare', maxLevel: 3, apply: (m) => { m.rescue *= 1.5; } },
  { id: 'demolition', name: '爆破專家', desc: '對木桶與補給箱傷害 ×2', rarity: 'common', maxLevel: 2, apply: (m) => { m.barrelDamage *= 2; } },
  { id: 'hunter', name: '獵殺者', desc: '對 Boss 傷害 +50%', rarity: 'rare', maxLevel: 3, apply: (m) => { m.bossDamage *= 1.5; } },
  { id: 'armor', name: '防彈衣', desc: '被殭屍碰到的損失 −20%', rarity: 'rare', maxLevel: 3, apply: (m) => { m.armor *= 0.8; } },
  {
    id: 'reinforce', name: '增援部隊', desc: '立刻增加 30% 兵力（至少 10 人）', rarity: 'common', maxLevel: 99,
    apply: () => {}, onPick: (count) => count + Math.max(10, Math.round(count * 0.3)),
  },
];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, rare: 3, epic: 1 };

export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: string; // what each level does
  /** Current total effect at level lv, e.g. "傷害 ×1.40". */
  effect: (lv: number) => string;
  baseCost: number; // cost of level n+1 = baseCost * costGrowth^n
}

// Permanent upgrades have no level cap. Each level multiplies its stat, so the
// bonus grows exponentially; every level bought also raises the threat level
// (see threatOf), which multiplies enemy toughness and the medals earned.
const fmt = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(2).replace(/\.?0+$/, ''));
export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'troops', name: '預備部隊', desc: '開局兵力每級 ×1.2', effect: (lv) => `開局 ${troopsAt(lv)} 人`, baseCost: 6 },
  { id: 'firepower', name: '武器改良', desc: '子彈傷害每級 ×1.12', effect: (lv) => `傷害 ×${fmt(1.12 ** lv)}`, baseCost: 8 },
  { id: 'drill', name: '射擊訓練', desc: '射速每級 ×1.08', effect: (lv) => `射速 ×${fmt(1.08 ** lv)}`, baseCost: 8 },
  { id: 'intel', name: '情報網', desc: '每局可重抽強化 +1 次', effect: (lv) => `重抽 ${lv} 次`, baseCost: 12 },
  { id: 'sapper', name: '工兵連', desc: '打閘門加值每級 ×1.15', effect: (lv) => `閘門 ×${fmt(1.15 ** lv)}`, baseCost: 10 },
  { id: 'medic', name: '醫護兵', desc: '被殭屍碰到的損失每級 ×0.92', effect: (lv) => `損失 ×${fmt(0.92 ** lv)}`, baseCost: 12 },
];

export const META_COST_GROWTH = 1.45;
export const metaCost = (u: MetaUpgradeDef, lv: number) => Math.round(u.baseCost * META_COST_GROWTH ** lv);
const troopsAt = (lv: number) => Math.round(ENDLESS.startCount * 1.2 ** lv);

/**
 * Threat level = total permanent upgrade levels. Enemies, barrels and bosses get
 * threatHp^T times tougher (slower than a single upgrade line grows, so buying
 * still pays off), and medals are multiplied by 1 + threatMedals * T.
 */
export function threatOf(levels: Record<string, number>): { level: number; hp: number; medals: number } {
  const level = Object.values(levels).reduce((a, b) => a + b, 0);
  return { level, hp: ENDLESS.threatHp ** level, medals: 1 + ENDLESS.threatMedals * level };
}

/** Applies permanent upgrades to a fresh run. */
export function metaStart(levels: Record<string, number>): { mods: RunMods; startCount: number; rerolls: number } {
  const lv = (id: string) => levels[id] ?? 0;
  const mods: RunMods = { ...IDENTITY_MODS };
  mods.damage *= 1.12 ** lv('firepower');
  // Fire rate beyond FIRE_RATE_CAP turns into damage, so the shot count stays sane.
  const rate = 1.08 ** lv('drill');
  mods.fireInterval /= Math.min(rate, FIRE_RATE_CAP);
  mods.damage *= Math.max(1, rate / FIRE_RATE_CAP);
  mods.gatePower *= 1.15 ** lv('sapper');
  mods.armor *= 0.92 ** lv('medic');
  return { mods, startCount: troopsAt(lv('troops')), rerolls: lv('intel') };
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
  // Threat from permanent upgrades (see threatOf).
  threatHp: 1.025,
  threatMedals: 0.05,
};
