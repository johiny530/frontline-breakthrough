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
  desc: string; // per level
  maxLevel: number;
  baseCost: number; // cost of level n+1 = baseCost * (n + 1)
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'troops', name: '預備部隊', desc: '開局兵力 +5', maxLevel: 5, baseCost: 6 },
  { id: 'firepower', name: '武器改良', desc: '子彈傷害 +10%', maxLevel: 5, baseCost: 8 },
  { id: 'drill', name: '射擊訓練', desc: '射擊間隔 −6%', maxLevel: 5, baseCost: 8 },
  { id: 'intel', name: '情報網', desc: '每局可重抽強化 +1 次', maxLevel: 3, baseCost: 12 },
  { id: 'sapper', name: '工兵連', desc: '打閘門加值 +15%', maxLevel: 3, baseCost: 10 },
  { id: 'medic', name: '醫護兵', desc: '被殭屍碰到的損失 −8%', maxLevel: 3, baseCost: 12 },
];

/** Applies permanent upgrades to a fresh run. */
export function metaStart(levels: Record<string, number>): { mods: RunMods; startCount: number; rerolls: number } {
  const lv = (id: string) => levels[id] ?? 0;
  const mods: RunMods = { ...IDENTITY_MODS };
  mods.damage *= 1 + 0.1 * lv('firepower');
  mods.fireInterval *= Math.pow(0.94, lv('drill'));
  mods.gatePower *= 1 + 0.15 * lv('sapper');
  mods.armor *= Math.pow(0.92, lv('medic'));
  return { mods, startCount: ENDLESS.startCount + 5 * lv('troops'), rerolls: lv('intel') };
}

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
  pressureBase: 1.2,
  pressureGrowth: 1.25,
  minArmy: 12, // A never counts below this, so tiny armies still meet enemies
  waveBodies: [30, 90] as const, // zombies per wave stay in this range; hp grows instead
  barrelHp: 0.5, // x A
  barrelReward: 0.08, // x A
  gateGood: 0.05, // x A
  gateBad: 0.15, // x A
  gateMax: 0.12, // x A
  crateHp: 0.8, // x A
  bossHp: 20, // x A, +25% per boss tier
  bossDps: 0.04, // x A soldiers per second on contact
};
