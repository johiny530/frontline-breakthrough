import { CONFIG } from '../data/config';
import { approach, clamp } from '../core/math';

export interface Unit {
  tier: number; // index into CONFIG.squad.tiers
  ox: number; // offset from the squad center (world units)
  oz: number;
  fireTimer: number;
}

const GOLDEN_ANGLE = 2.399963;
const TIERS = CONFIG.squad.tiers;

export const tierValue = (tier: number): number => TIERS[tier].value;
export const tierRadius = (tier: number): number => TIERS[tier].radius;

/** Splits a soldier count into ranks, highest first: 123 -> [2, 1, 1, 0, 0, 0]. */
export function decompose(count: number): number[] {
  const tiers: number[] = [];
  let rest = count;
  for (let t = TIERS.length - 1; t >= 0; t--) {
    // Lower tiers hold at most 9 units; the top tier holds the rest.
    const n = t === TIERS.length - 1 ? Math.floor(rest / TIERS[t].value) : Math.min(9, Math.floor(rest / TIERS[t].value));
    for (let i = 0; i < n; i++) tiers.push(t);
    rest -= n * TIERS[t].value;
  }
  return tiers;
}

/**
 * The player's army. `count` is the real number of soldiers; it is shown as
 * ranked units (1 / 10 / 100 / 1000) so the formation stays small enough to steer.
 * Units are packed in a sunflower pattern, biggest in the middle.
 */
export class Squad {
  x = 0;
  targetX = 0;
  z = 0;
  count: number;
  readonly units: Unit[] = [];
  private slots: [number, number][] = [];
  private extent = 0;
  // Where newly formed units appear (world space), e.g. a broken barrel.
  private spawnFrom: { x: number; z: number } | null = null;

  constructor(count: number) {
    this.count = count;
    this.syncFormation(true);
  }

  /** Formation radius, including the outermost unit's body. */
  get radius(): number {
    return this.extent;
  }

  get halfWidthX(): number {
    return this.extent;
  }

  add(n: number, fromX?: number, fromZ?: number): void {
    if (n <= 0) return;
    if (fromX !== undefined && fromZ !== undefined) this.spawnFrom = { x: fromX, z: fromZ };
    this.count += n;
    this.syncFormation(false);
    this.spawnFrom = null;
  }

  remove(n: number): void {
    if (n <= 0) return;
    this.count = Math.max(0, this.count - n);
    this.syncFormation(false);
  }

  update(dt: number): void {
    const edge = CONFIG.track.halfWidth;
    const limit = Math.max(0, edge - this.extent);
    // Clamp the target too, so steering back from the curb responds immediately.
    this.targetX = clamp(this.targetX, -limit, limit);
    this.x += (this.targetX - this.x) * approach(CONFIG.squad.followRate, dt);

    const k = approach(CONFIG.squad.slotFollowRate, dt);
    for (let i = 0; i < this.units.length; i++) {
      const [sx, sz] = this.slots[i];
      const u = this.units[i];
      u.ox += (sx - u.ox) * k;
      u.oz += (sz - u.oz) * k;
    }
  }

  /**
   * Rebuilds the unit list for the current count. Units of a tier that still
   * exists keep their position; merged or new units start at the spawn point
   * (or the centroid of the units they replace) and walk to their slots.
   */
  private syncFormation(snap: boolean): void {
    const wanted = decompose(this.count);
    const pool = new Map<number, Unit[]>();
    for (const u of this.units) {
      const list = pool.get(u.tier) ?? [];
      list.push(u);
      pool.set(u.tier, list);
    }
    // Centroid of the old formation: where merged units appear.
    let cx = 0;
    let cz = 0;
    for (const u of this.units) { cx += u.ox; cz += u.oz; }
    if (this.units.length) { cx /= this.units.length; cz /= this.units.length; }

    this.computeSlots(wanted);
    const next: Unit[] = [];
    wanted.forEach((tier, i) => {
      const reuse = pool.get(tier)?.shift();
      if (reuse) { next.push(reuse); return; }
      let [ox, oz] = this.slots[i];
      if (!snap) {
        if (this.spawnFrom) { ox = this.spawnFrom.x - this.x; oz = this.spawnFrom.z - this.z; }
        else { ox = cx; oz = cz; }
      }
      next.push({ tier, ox, oz, fireTimer: Math.random() * CONFIG.fire.interval });
    });
    this.units.length = 0;
    this.units.push(...next);
  }

  /** Area-weighted sunflower: each unit sits at the radius enclosing the ones before it. */
  private computeSlots(tiers: number[]): void {
    this.slots = [];
    let area = 0;
    let extent = 0;
    tiers.forEach((t, i) => {
      const r = tierRadius(t);
      const dist = i === 0 ? 0 : Math.sqrt(area / Math.PI);
      const a = i * GOLDEN_ANGLE;
      this.slots.push([Math.cos(a) * dist, Math.sin(a) * dist]);
      area += CONFIG.squad.packing * (2 * r) * (2 * r);
      extent = Math.max(extent, dist + r);
    });
    this.extent = extent;
  }
}
