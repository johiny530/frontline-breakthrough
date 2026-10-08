import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import type { LevelDef } from '../src/data/levels';
import { decompose, Squad, tierValue } from '../src/entities/Squad';
import { Stage } from '../src/core/Stage';
import { Enemy } from '../src/entities/Enemy';
import { updateCombat } from '../src/systems/combat';
import { generateSector } from '../src/core/endless/Generator';
import { EndlessRun } from '../src/core/endless/EndlessRun';
import { IDENTITY_MODS, META_UPGRADES, metaCost, PERKS } from '../src/data/endless';
import { endlessUnlocked, loadSave } from '../src/core/Storage';

const sum = (tiers: number[]) => tiers.reduce((a, t) => a + tierValue(t), 0);

describe('rank decomposition', () => {
  it('splits a count into ranks, highest first', () => {
    expect(decompose(123)).toEqual([2, 1, 1, 0, 0, 0]);
    expect(decompose(0)).toEqual([]);
    expect(decompose(9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('always adds back up to the count, with at most 9 of each lower rank', () => {
    for (const n of [1, 10, 99, 100, 1234, 9999, 10001, 123456]) {
      const tiers = decompose(n);
      expect(sum(tiers)).toBe(n);
      for (let t = 0; t < CONFIG.squad.tiers.length - 1; t++) {
        expect(tiers.filter((x) => x === t).length).toBeLessThanOrEqual(9);
      }
    }
  });

  it('keeps the squad units in sync with add/remove', () => {
    const sq = new Squad(15);
    sq.add(990);
    expect(sq.count).toBe(1005);
    expect(sum(sq.units.map((u) => u.tier))).toBe(1005);
    sq.remove(6);
    expect(sum(sq.units.map((u) => u.tier))).toBe(999);
    sq.remove(5000);
    expect(sq.count).toBe(0);
    expect(sq.units).toHaveLength(0);
  });

  it('keeps a big army narrow enough to reach the lanes', () => {
    const sq = new Squad(130);
    // Lane gates sit at x = +-2 with half width 1.8: the center must get past 0.2.
    expect(CONFIG.track.halfWidth - sq.halfWidthX).toBeGreaterThan(0.2);
  });
});

/** Runs a stage with a fixed steering target until it ends or time runs out. */
function runStage(st: Stage, targetX: number, seconds = 60): void {
  for (let t = 0; t < seconds * 60 && st.status === 'playing'; t++) {
    st.squad.targetX = targetX;
    st.update(1 / 60);
    st.events.length = 0;
  }
}

describe('stage rules', () => {
  const base = (items: LevelDef['items'], start = 10, length = 40): LevelDef => ({ name: 'test', length, startSoldiers: start, items });

  it('adds soldiers when passing a positive gate, even with a big army', () => {
    const st = new Stage(base([{ kind: 'gate', at: 15, lane: 'left', value: 40, perHit: 0, max: 40 }], 130), 0);
    runStage(st, -4);
    expect(st.status).toBe('won');
    expect(st.squad.count).toBe(170);
  });

  it('multiplier gates scale the army', () => {
    const st = new Stage(base([{ kind: 'gate', op: 'mul', at: 15, lane: 'right', value: 2, perHit: 0, max: 2 }], 50), 0);
    runStage(st, 4);
    expect(st.squad.count).toBe(100);
  });

  it('spikes cost soldiers unless the squad steers around them', () => {
    const spikes: LevelDef['items'] = [{ kind: 'hazard', at: 15, x: -2, halfWidth: 1.9 }];
    const hit = new Stage(base(spikes, 100), 0);
    runStage(hit, -4);
    expect(hit.squad.count).toBeLessThan(60);
    const dodge = new Stage(base(spikes, 100), 0);
    runStage(dodge, 4);
    expect(dodge.squad.count).toBe(100);
  });

  it('passes between two gates without touching either', () => {
    const st = new Stage(base([
      { kind: 'gate', at: 15, lane: 'left', value: -5, perHit: 0, max: 40 },
      { kind: 'gate', at: 15, lane: 'right', value: -5, perHit: 0, max: 40 },
    ]), 0);
    runStage(st, 0);
    expect(st.squad.count).toBe(10);
  });

  it('pierces: one heavy bullet kills several weak enemies in a row', () => {
    const st = new Stage(base([]), 0);
    for (const u of st.squad.units) u.fireTimer = 99; // keep the squad from firing
    for (let i = 0; i < 5; i++) st.enemies.push(new Enemy(0, -10 - i * 0.8, 2, CONFIG.enemy.radius));
    st.bullets.spawn(0, -2, 0, -CONFIG.fire.bulletSpeed, 1, 10);
    for (let f = 0; f < 40; f++) updateCombat(st, 1 / 60);
    expect(st.score.kills).toBe(5);
    expect(st.bullets.list).toHaveLength(0); // all damage spent
  });
});

describe('endless generator', () => {
  it('is deterministic for a seed', () => {
    expect(generateSector(3, 42, 100)).toEqual(generateSector(3, 42, 100));
    expect(generateSector(3, 42, 100)).not.toEqual(generateSector(3, 43, 100));
  });

  it('puts a boss on every fifth sector only', () => {
    for (let n = 1; n <= 15; n++) {
      expect(generateSector(n, 1, 50).boss !== undefined).toBe(n % 5 === 0);
    }
  });

  it('speeds up sector by sector, up to a cap', () => {
    const speeds = [1, 5, 10, 40].map((n) => generateSector(n, 1, 50).speed!);
    expect(speeds[1]).toBeGreaterThan(speeds[0]);
    expect(speeds[0]).toBeGreaterThan(1);
    expect(speeds[3]).toBeCloseTo(1.8);
  });

  it('scales the threat with the army entering the sector', () => {
    const hp = (def: LevelDef) => def.items.reduce((a, it) => a + (it.kind === 'enemies' ? it.count * it.hp : 0), 0);
    expect(hp(generateSector(4, 7, 1000))).toBeGreaterThan(hp(generateSector(4, 7, 100)) * 5);
  });
});

describe('endless run', () => {
  it('offers three different perks', () => {
    const run = new EndlessRun({}, 1);
    const offer = run.offer();
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map((p) => p.id)).size).toBe(3);
  });

  it('applies perks to the shared modifiers', () => {
    const run = new EndlessRun({}, 1);
    const rapid = PERKS.find((p) => p.id === 'rapid')!;
    run.take(rapid);
    expect(run.mods.fireInterval).toBeCloseTo(IDENTITY_MODS.fireInterval * 0.85);
    const st = run.createStage();
    expect(st.mods).toBe(run.mods);
  });

  it('reinforcements add at least 10 soldiers', () => {
    const run = new EndlessRun({}, 1);
    const before = run.count;
    expect(run.take(PERKS.find((p) => p.id === 'reinforce')!)).toBe(10);
    expect(run.count).toBe(before + 10);
  });

  it('permanent upgrades change the starting run', () => {
    const run = new EndlessRun({ troops: 2, intel: 3 }, 1);
    expect(run.count).toBe(17); // 12 * 1.2^2
    expect(run.rerolls).toBe(3);
    expect(run.threat.level).toBe(5);
  });

  it('permanent upgrades have no cap and raise the threat', () => {
    const run = new EndlessRun({ firepower: 40, drill: 40 }, 1);
    expect(run.mods.fireInterval).toBeCloseTo(1 / 3); // fire rate capped at x3
    expect(run.mods.damage).toBeGreaterThan(1.12 ** 40); // the rest becomes damage
    expect(run.threat.hp).toBeCloseTo(1.025 ** 80);
    const plain = generateSector(3, 7, 50);
    const hard = generateSector(3, 7, 50, run.threat.hp);
    const hp = (d: LevelDef) => d.items.reduce((a, it) => a + (it.kind === 'enemies' ? it.hp * it.count : 0), 0);
    expect(hp(hard)).toBeGreaterThan(hp(plain) * 5);
    expect(metaCost(META_UPGRADES[0], 10)).toBeGreaterThan(metaCost(META_UPGRADES[0], 9));
  });
});

describe('save data', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };
  });

  it('migrates a save from before endless mode', () => {
    store.set('frontline-breakthrough.save.v1', JSON.stringify({ best: [100, 200, 0, 0, 0], unlocked: 3 }));
    const s = loadSave(5);
    expect(s.best).toEqual([100, 200, 0, 0, 0]);
    expect(s.medals).toBe(0);
    expect(s.meta).toEqual({});
    expect(s.endless).toEqual({ sector: 0, score: 0 });
    expect(endlessUnlocked(s)).toBe(false);
  });

  it('survives a corrupted save', () => {
    store.set('frontline-breakthrough.save.v1', '{oops');
    expect(loadSave(5).unlocked).toBe(1);
  });
});
