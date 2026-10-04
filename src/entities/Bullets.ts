export interface Bullet {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
}

// Simple pooled bullet list; swap-remove keeps it O(1) per removal.
export class Bullets {
  readonly list: Bullet[] = [];
  private pool: Bullet[] = [];

  spawn(x: number, z: number, vx: number, vz: number, life: number, damage: number): void {
    const b = this.pool.pop() ?? { x: 0, z: 0, vx: 0, vz: 0, life: 0, damage: 0 };
    b.x = x; b.z = z; b.vx = vx; b.vz = vz; b.life = life; b.damage = damage;
    this.list.push(b);
  }

  removeAt(i: number): void {
    const removed = this.list[i];
    const last = this.list.pop()!;
    if (i < this.list.length) this.list[i] = last;
    this.pool.push(removed);
  }

  clear(): void {
    this.pool.push(...this.list);
    this.list.length = 0;
  }
}
