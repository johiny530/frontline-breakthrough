import * as THREE from 'three';
import { CONFIG } from '../data/config';
import { mulberry32 } from '../core/math';
import type { Assets } from './Assets';

const SAND = 0xe3c08a;
const ROAD = 0x9a9ca3;

/** Renderer, camera, lights and the static desert scenery. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private ground: THREE.Mesh;
  private track: THREE.Group | null = null;
  private trackDisposables: { dispose(): void }[] = [];

  constructor(private container: HTMLElement, private assets: Assets) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.prepend(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xf2dcb0);
    this.scene.fog = new THREE.Fog(0xf2dcb0, 30, 70);

    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 9 / 16, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9a777, 2.2));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(6, 12, 5);
    this.scene.add(sun);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshLambertMaterial({ color: SAND }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.scene.add(this.ground);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Builds road, lane marks, finish line and roadside rocks for a level. */
  buildTrack(length: number, seed: number): void {
    if (this.track) this.scene.remove(this.track);
    for (const d of this.trackDisposables) d.dispose();
    this.trackDisposables = [];
    const g = new THREE.Group();
    const hw = CONFIG.track.halfWidth;
    const total = length + 60;

    const road = new THREE.Mesh(this.trackOwn(new THREE.PlaneGeometry(hw * 2 + 0.6, total)), this.trackOwn(new THREE.MeshLambertMaterial({ color: ROAD })));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -total / 2 + 20);
    g.add(road);

    // Curbs and dashed center line.
    const white = this.trackOwn(new THREE.MeshBasicMaterial({ color: 0xf4f4f4 }));
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(this.trackOwn(new THREE.BoxGeometry(0.25, 0.08, total)), white);
      curb.position.set(side * (hw + 0.3), 0.04, -total / 2 + 20);
      g.add(curb);
    }
    const dashGeo = this.trackOwn(new THREE.PlaneGeometry(0.15, 1.6));
    for (let z = 15; z > -total + 20; z -= 4) {
      const dash = new THREE.Mesh(dashGeo, white);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.01, z);
      g.add(dash);
    }

    g.add(this.finishLine(length));

    // Roadside rocks.
    const rand = mulberry32(seed);
    const rocks = [this.assets.rockA, this.assets.rockB, this.assets.rockC];
    for (let z = 15; z > -total; z -= 2.5) {
      for (const side of [-1, 1]) {
        if (rand() < 0.45) continue;
        const rock = rocks[Math.floor(rand() * rocks.length)].scene.clone();
        rock.scale.setScalar(2.5 + rand() * 4);
        rock.rotation.y = rand() * Math.PI * 2;
        rock.position.set(side * (hw + 1.5 + rand() * 9), 0, z + rand() * 2);
        g.add(rock);
      }
    }

    this.track = g;
    this.scene.add(g);
  }

  private trackOwn<T extends { dispose(): void }>(d: T): T {
    this.trackDisposables.push(d);
    return d;
  }

  private finishLine(length: number): THREE.Mesh {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        ctx.fillRect(i * 8, j * 8, 8, 8);
      }
    }
    const tex = this.trackOwn(new THREE.CanvasTexture(c));
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      this.trackOwn(new THREE.PlaneGeometry(CONFIG.track.halfWidth * 2, 1)),
      this.trackOwn(new THREE.MeshBasicMaterial({ map: tex })),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.015, -length);
    return m;
  }

  /** Follow the squad from behind and above, like the original game. */
  follow(x: number, z: number): void {
    const c = CONFIG.camera;
    const cx = x * c.followX;
    this.camera.position.set(cx, c.height, z + c.back);
    this.camera.lookAt(cx, 0, z - c.lookAhead);
    this.ground.position.x = cx;
    this.ground.position.z = z - 40;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
