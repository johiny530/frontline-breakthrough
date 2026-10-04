import * as THREE from 'three';

const BLOOD_LIFE = 2.5;
const MAX_SPLATS = 120;

interface Splat { life: number; size: number }

/** Blood splats on the ground, drawn as one instanced mesh. */
export class Effects {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private splats: Splat[] = [];
  private positions: THREE.Vector3[] = [];
  private tmp = new THREE.Matrix4();
  private q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  private s = new THREE.Vector3();
  private next = 0;

  constructor() {
    const geo = new THREE.CircleGeometry(0.5, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0xa3121b, transparent: true, opacity: 0.85, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_SPLATS);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    for (let i = 0; i < MAX_SPLATS; i++) {
      this.splats.push({ life: 0, size: 0 });
      this.positions.push(new THREE.Vector3());
    }
    this.group.add(this.mesh);
  }

  blood(x: number, z: number): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX_SPLATS;
    this.splats[i].life = BLOOD_LIFE;
    this.splats[i].size = 0.5 + Math.random() * 0.5;
    this.positions[i].set(x, 0.02 + i * 0.0001, z);
  }

  clear(): void {
    for (const s of this.splats) s.life = 0;
  }

  update(dt: number): void {
    let n = 0;
    for (let i = 0; i < MAX_SPLATS; i++) {
      const sp = this.splats[i];
      if (sp.life <= 0) continue;
      sp.life -= dt;
      // Grow fast, then shrink away near the end.
      const age = BLOOD_LIFE - sp.life;
      const k = Math.min(1, age * 8) * Math.min(1, sp.life * 1.5);
      this.s.setScalar(Math.max(0.001, sp.size * k));
      this.tmp.compose(this.positions[i], this.q, this.s);
      this.mesh.setMatrixAt(n++, this.tmp);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
