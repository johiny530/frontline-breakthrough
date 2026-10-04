import { ENDLESS } from '../../data/endless';
import type { ItemDef, Lane, LevelDef } from '../../data/levels';
import { clamp, mulberry32 } from '../math';

/**
 * Builds sector n of an endless run as an ordinary LevelDef, so the regular
 * Stage runs it. The road is a sequence of "beats" (gate choice, enemy wave,
 * barrels...). Numbers scale with the army entering the sector, times a
 * pressure that grows each sector, so a snowballing army still meets a
 * matching threat and perks decide how long the run lasts.
 * Deterministic for a given seed, sector and army size.
 */
export function generateSector(n: number, seed: number, startSoldiers: number): LevelDef {
  const E = ENDLESS;
  const rand = mulberry32(seed * 7919 + n * 104729);
  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
  const between = (a: number, b: number) => a + rand() * (b - a);
  const isBoss = n % E.bossEvery === 0;
  const length = isBoss ? 100 : E.sectorLength;

  const A = Math.max(E.minArmy, startSoldiers);
  const pressure = E.pressureBase * Math.pow(E.pressureGrowth, n);
  const [minBodies, maxBodies] = E.waveBodies;

  /** A wave worth `scale` of the standard threat, as bodies x hp. */
  const wave = (at: number, x: number, scale: number, spread: number, toughness = 1): ItemDef => {
    const totalHp = A * pressure * scale * between(0.85, 1.15);
    const bodies = Math.round(clamp((20 + 6 * n) * scale / toughness, minBodies * scale, maxBodies * scale));
    const hp = Math.max(1, Math.ceil(totalHp / Math.max(1, bodies)));
    return { kind: 'enemies', at, x, count: Math.max(4, Math.min(bodies, Math.ceil(totalHp))), hp, spread };
  };
  const gateMax = Math.round(A * E.gateMax + 20);
  const perHit = gateMax / 60;
  const goodGate = () => Math.round(A * E.gateGood * between(0.8, 1.2) + 4);
  const badGate = () => -Math.round(A * E.gateBad * between(0.8, 1.2) + 5);
  const barrelHp = (scale: number) => Math.round(A * E.barrelHp * scale + 15);
  const reward = (scale: number) => Math.round((A * E.barrelReward + 5) * scale * between(0.8, 1.2));

  const items: ItemDef[] = [];
  const side = (): Lane => (rand() < 0.5 ? 'left' : 'right');
  const other = (l: Lane): Lane => (l === 'left' ? 'right' : 'left');
  const lx = (l: Lane) => (l === 'left' ? -2 : 2);

  const beats: Record<string, (at: number) => void> = {
    gateChoice(at) {
      const good = side();
      items.push({ kind: 'gate', at, lane: good, value: goodGate(), perHit, max: gateMax });
      items.push({ kind: 'gate', at, lane: other(good), value: badGate(), perHit: perHit * 1.5, max: gateMax });
    },
    riskyGates(at) {
      // Both negative: shoot one up into the positives or squeeze through the gap.
      for (const l of ['left', 'right'] as Lane[]) {
        items.push({ kind: 'gate', at, lane: l, value: Math.round(badGate() * 0.7), perHit: perHit * 1.5, max: gateMax });
      }
    },
    wave(at) { items.push(wave(at, 0, 1, 3.2)); },
    flankWaves(at) { for (const x of [-2, 2]) items.push(wave(at, x, 0.55, 1.6)); },
    heavyWave(at) { items.push(wave(at, 0, 0.8, 3.2, 2.5)); },
    barrels(at) {
      const l = side();
      items.push({ kind: 'barrel', at, x: lx(l), hp: barrelHp(1), reward: reward(1) });
      items.push({ kind: 'barrel', at: at + 9, x: lx(other(l)), hp: barrelHp(1.5), reward: reward(1.6) });
    },
    barrelAndGate(at) {
      const l = side();
      items.push({ kind: 'barrel', at, x: lx(l), hp: barrelHp(1.2), reward: reward(1.1) });
      items.push({ kind: 'gate', at, lane: other(l), value: Math.round(goodGate() * 0.6), perHit, max: gateMax });
    },
  };

  // Fixed opening, then a shuffled middle, then a final wave.
  let at = 16;
  beats.gateChoice(at);
  const middle = ['wave', 'barrels', 'flankWaves', 'barrelAndGate', 'heavyWave', 'riskyGates', 'wave'];
  const spacing = 17;
  while (at + spacing < length - 14) {
    at += spacing + between(-2, 2);
    beats[pick(middle)](at);
  }
  if (!isBoss) beats.wave(length - 6);

  // Supply crate: a tough box in one lane that grants a random perk.
  if (rand() < E.crateChance) {
    items.push({ kind: 'barrel', at: between(35, length - 30), x: lx(side()), hp: Math.round(A * E.crateHp + 20), reward: 0, crate: true });
  }

  const tier = n / E.bossEvery;
  return {
    name: isBoss ? `第 ${n} 段・Boss` : `第 ${n} 段`,
    length,
    startSoldiers,
    items: items.sort((a, b) => a.at - b.at),
    boss: isBoss
      ? { hp: Math.round(A * E.bossHp * (1 + 0.25 * (tier - 1))), speed: 1 + 0.1 * tier, contactDps: Math.round(A * E.bossDps * (1 + 0.2 * tier) + 5) }
      : undefined,
  };
}
