import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

const BASE = `${import.meta.env.BASE_URL}assets/kenney/`;

const MODEL_PATHS = {
  soldier: 'blocky/character-m.glb',
  zombie: 'blocky/character-l.glb',
  boss: 'blocky/character-o.glb',
  rifle: 'blaster/blaster-d.glb',
  barrel: 'survival/barrel.glb',
  rockA: 'survival/rock-sand-a.glb',
  rockB: 'survival/rock-sand-b.glb',
  rockC: 'survival/rock-sand-c.glb',
} as const;

export type ModelName = keyof typeof MODEL_PATHS;
export type Assets = Record<ModelName, GLTF>;

export async function loadAssets(onProgress?: (done: number, total: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  const names = Object.keys(MODEL_PATHS) as ModelName[];
  let done = 0;
  const loaded = await Promise.all(
    names.map(async (name) => {
      const gltf = await loader.loadAsync(BASE + MODEL_PATHS[name]);
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Kenney textures are tiny pixel-art atlases; keep them crisp.
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.map) {
          mat.map.magFilter = THREE.NearestFilter;
          mat.map.minFilter = THREE.NearestFilter;
          mat.map.generateMipmaps = false;
        }
      });
      onProgress?.(++done, names.length);
      return [name, gltf] as const;
    }),
  );
  return Object.fromEntries(loaded) as Assets;
}

/** Height of a model in its own units (static pose). */
export function modelHeight(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  return box.max.y - box.min.y;
}
