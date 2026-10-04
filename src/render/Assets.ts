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

// Single-file builds (see scripts/build-artifact.mjs) inline every model and
// texture as a data URI in this map, keyed by its path under assets/kenney/.
declare global {
  interface Window { __FB_INLINE_ASSETS?: Record<string, string> }
}

function createLoader(): GLTFLoader {
  const inline = window.__FB_INLINE_ASSETS;
  if (!inline) return new GLTFLoader();
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const i = url.indexOf('assets/kenney/');
    return i >= 0 ? inline[url.slice(i + 'assets/kenney/'.length)] ?? url : url;
  });
  const loader = new GLTFLoader(manager);
  // The default ImageBitmapLoader fetch()es textures, which sandboxed hosts may
  // block; TextureLoader uses an <img> element, which accepts data: URIs.
  loader.register((parser) => {
    (parser as unknown as { textureLoader: THREE.Loader }).textureLoader = new THREE.TextureLoader(manager);
    return { name: 'fb_img_textures' };
  });
  return loader;
}

/** Inline builds parse the decoded bytes directly instead of fetching. */
async function loadModel(loader: GLTFLoader, path: string): Promise<GLTF> {
  const dataUri = window.__FB_INLINE_ASSETS?.[path];
  if (!dataUri) return loader.loadAsync(BASE + path);
  const bin = atob(dataUri.slice(dataUri.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dir = BASE + path.slice(0, path.lastIndexOf('/') + 1);
  return loader.parseAsync(bytes.buffer, dir);
}

export async function loadAssets(onProgress?: (done: number, total: number) => void): Promise<Assets> {
  const loader = createLoader();
  const names = Object.keys(MODEL_PATHS) as ModelName[];
  let done = 0;
  const loaded = await Promise.all(
    names.map(async (name) => {
      const gltf = await loadModel(loader, MODEL_PATHS[name]);
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
