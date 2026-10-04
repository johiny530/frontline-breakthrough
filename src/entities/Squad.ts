import { CONFIG } from '../data/config';
import { approach, clamp } from '../core/math';

export interface Soldier {
  // Offset from the squad center (world units).
  ox: number;
  oz: number;
  fireTimer: number;
}

const GOLDEN_ANGLE = 2.399963;

/**
 * The player's crowd. `count` is the real number of soldiers; only up to
 * CONFIG.squad.maxDisplayed of them exist as Soldier objects in a sunflower formation.
 */
export class Squad {
  x = 0;
  targetX = 0;
  z = 0;
  count: number;
  readonly soldiers: Soldier[] = [];
  private squeeze = 1;
  // Where newly added soldiers appear (world space), e.g. a broken barrel.
  private spawnFrom: { x: number; z: number } | null = null;

  constructor(count: number) {
    this.count = count;
    this.syncFormation(true);
  }

  get displayed(): number {
    return Math.min(this.count, CONFIG.squad.maxDisplayed);
  }

  /** Formation radius before squeezing to the road width. */
  get radius(): number {
    return CONFIG.squad.spacing * Math.sqrt(Math.max(1, this.displayed));
  }

  /** Half extent along x after squeezing. */
  get halfWidthX(): number {
    return this.radius * this.squeeze;
  }

  add(n: number, fromX?: number, fromZ?: number): void {
    if (n <= 0) return;
    if (fromX !== undefined && fromZ !== undefined) this.spawnFrom = { x: fromX, z: fromZ };
    this.count += n;
    this.syncFormation(false);
    this.spawnFrom = null;
  }

  remove(n: number): void {
    this.count = Math.max(0, this.count - n);
    this.syncFormation(false);
  }

  update(dt: number): void {
    const s = CONFIG.squad;
    const edge = CONFIG.track.halfWidth - s.soldierRadius;
    this.squeeze = Math.min(1, edge / Math.max(this.radius, 0.01));
    const limit = Math.max(0, edge - this.halfWidthX);
    this.targetX = clamp(this.targetX, -edge, edge);
    this.x += (clamp(this.targetX, -limit, limit) - this.x) * approach(s.followRate, dt);

    const k = approach(s.slotFollowRate, dt);
    for (let i = 0; i < this.soldiers.length; i++) {
      const [sx, sz] = this.slot(i);
      const sol = this.soldiers[i];
      sol.ox += (sx - sol.ox) * k;
      sol.oz += (sz - sol.oz) * k;
    }
  }

  slot(i: number): [number, number] {
    if (i === 0) return [0, 0];
    const r = CONFIG.squad.spacing * Math.sqrt(i);
    const a = i * GOLDEN_ANGLE;
    return [Math.cos(a) * r * this.squeeze, Math.sin(a) * r];
  }

  private syncFormation(snap: boolean): void {
    const want = this.displayed;
    while (this.soldiers.length > want) this.soldiers.pop();
    while (this.soldiers.length < want) {
      const i = this.soldiers.length;
      let [ox, oz] = this.slot(i);
      if (!snap && this.spawnFrom) {
        ox = this.spawnFrom.x - this.x;
        oz = this.spawnFrom.z - this.z;
      }
      this.soldiers.push({ ox, oz, fireTimer: Math.random() * CONFIG.fire.interval });
    }
  }
}
