import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

export interface CrowdClip {
  name: string;
  /** Keep only tracks whose name passes, e.g. legs from "walk". */
  filter?: (trackName: string) => boolean;
  timeScale?: number;
}

export interface CrowdAttachment {
  node: string; // node name inside the character
  object: THREE.Object3D; // placed in that node's local space
}

export interface CrowdOptions {
  height: number;
  clips: CrowdClip[];
  maxCount: number;
  variants?: number; // animation phase variants, to avoid perfect sync
  facing?: number; // yaw applied to the model (radians)
  attach?: CrowdAttachment;
  tint?: number; // multiplies the material color, e.g. to make a variant
}

interface Template {
  wrapper: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  parts: THREE.Mesh[];
}

/**
 * Draws many copies of a rigid-part animated character (Kenney Blocky Characters
 * animate node transforms, not skins). A few template copies run the animation;
 * every body part becomes one InstancedMesh, so the whole crowd costs one draw
 * call per part regardless of size.
 */
export class CrowdRenderer {
  readonly group = new THREE.Group();
  private templates: Template[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private bases: THREE.Matrix4[] = [];
  private count = 0;
  private tmp = new THREE.Matrix4();

  constructor(gltf: GLTF, opts: CrowdOptions) {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const scale = opts.height / (box.max.y - box.min.y);
    const variants = opts.variants ?? 3;

    for (let v = 0; v < variants; v++) {
      const model = gltf.scene.clone(true);
      if (opts.attach) {
        const node = model.getObjectByName(opts.attach.node);
        node?.add(opts.attach.object.clone(true));
      }
      const wrapper = new THREE.Object3D();
      wrapper.scale.setScalar(scale);
      wrapper.position.y = -box.min.y * scale;
      wrapper.rotation.y = opts.facing ?? 0;
      wrapper.add(model);

      const mixer = new THREE.AnimationMixer(model);
      for (const c of opts.clips) {
        let clip = THREE.AnimationClip.findByName(gltf.animations, c.name);
        if (!clip) continue;
        if (c.filter) {
          clip = clip.clone();
          clip.tracks = clip.tracks.filter((t) => c.filter!(t.name));
        }
        const action = mixer.clipAction(clip);
        action.timeScale = c.timeScale ?? 1;
        action.play();
      }
      mixer.setTime((v / variants) * 0.8);

      const parts: THREE.Mesh[] = [];
      wrapper.traverse((o) => { if ((o as THREE.Mesh).isMesh) parts.push(o as THREE.Mesh); });
      this.templates.push({ wrapper, mixer, parts });
    }

    for (const part of this.templates[0].parts) {
      let material = part.material as THREE.MeshStandardMaterial;
      if (opts.tint !== undefined) {
        material = material.clone();
        material.color.multiply(new THREE.Color(opts.tint));
      }
      const im = new THREE.InstancedMesh(part.geometry, material, opts.maxCount);
      im.count = 0;
      im.frustumCulled = false; // instances span the whole track
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.push(im);
      this.group.add(im);
    }
    for (let i = 0; i < opts.maxCount; i++) this.bases.push(new THREE.Matrix4());
  }

  get capacity(): number {
    return this.bases.length;
  }

  /** Start a frame: add() every instance, then update(). */
  begin(): void {
    this.count = 0;
  }

  /** Add one instance; returns false when full. */
  add(x: number, y: number, z: number, yaw = 0, scale = 1, tilt = 0): boolean {
    if (this.count >= this.bases.length) return false;
    const m = this.bases[this.count++];
    m.makeRotationY(yaw);
    if (tilt !== 0) m.multiply(this.tmp.makeRotationX(tilt));
    if (scale !== 1) m.multiply(this.tmp.makeScale(scale, scale, scale));
    m.setPosition(x, y, z);
    return true;
  }

  update(dt: number): void {
    for (const t of this.templates) {
      t.mixer.update(dt);
      t.wrapper.updateMatrixWorld(true);
    }
    const k = this.templates.length;
    for (let p = 0; p < this.meshes.length; p++) {
      const im = this.meshes[p];
      for (let i = 0; i < this.count; i++) {
        this.tmp.multiplyMatrices(this.bases[i], this.templates[i % k].parts[p].matrixWorld);
        im.setMatrixAt(i, this.tmp);
      }
      im.count = this.count;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
