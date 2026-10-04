import * as THREE from 'three';

const MAX = 240;
const GRAVITY = 18;

interface Chip {
  life: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  size: number;
}

/** Flying chunks (barrel splinters, crate parts) with gravity; one instanced mesh. */
export class Debris {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private chips: Chip[] = [];
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private color = new THREE.Color();

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      MAX,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < MAX; i++) {
      this.chips.push({ life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), size: 0 });
      this.mesh.setColorAt(i, this.color.set(0xffffff));
    }
    this.group.add(this.mesh);
  }

  burst(x: number, y: number, z: number, color: number, count: number, power = 1): void {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const c = this.chips[i];
      c.life = 0.9 + Math.random() * 0.5;
      c.pos.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.6);
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 4) * power;
      c.vel.set(Math.cos(a) * sp, (4 + Math.random() * 5) * power, Math.sin(a) * sp);
      c.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      c.size = 0.12 + Math.random() * 0.18;
      // Slight shade variation so chips read as separate pieces.
      this.mesh.setColorAt(i, this.color.set(color).multiplyScalar(0.75 + Math.random() * 0.4));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    for (const c of this.chips) c.life = 0;
  }

  update(dt: number): void {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const c = this.chips[i];
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vel.y -= GRAVITY * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < c.size / 2) {
        // Bounce once, then slide to a stop.
        c.pos.y = c.size / 2;
        c.vel.y *= -0.3;
        c.vel.x *= 0.6;
        c.vel.z *= 0.6;
      }
      c.rot.x += c.spin.x * dt;
      c.rot.y += c.spin.y * dt;
      c.rot.z += c.spin.z * dt;
      const shrink = Math.min(1, c.life * 3);
      this.s.setScalar(c.size * shrink);
      this.m.compose(c.pos, this.q.setFromEuler(c.rot), this.s);
      // Keep instance index stable so per-chip colors stay put.
      this.mesh.setMatrixAt(i, this.m);
      n++;
    }
    // Dead chips: collapse to zero scale instead of compacting (colors are per index).
    if (n > 0 || this.mesh.count > 0) {
      for (let i = 0; i < MAX; i++) if (this.chips[i].life <= 0) this.mesh.setMatrixAt(i, ZERO);
      this.mesh.count = n > 0 ? MAX : 0;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
