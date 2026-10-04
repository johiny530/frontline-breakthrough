import * as THREE from 'three';
import { CONFIG } from '../data/config';
import type { Stage } from '../core/Stage';
import type { Enemy } from '../entities/Enemy';
import type { Assets } from './Assets';
import { CrowdRenderer } from './CrowdRenderer';
import { Effects } from './Effects';
import { TextSprite } from './TextSprite';
import type { World } from './World';

const MAX_BULLETS = 1200;
const BULLET_Y = 0.45;
const VIEW_AHEAD = 60;
const VIEW_BEHIND = 8;

/** Renderers that live for the whole session and are reused by every stage. */
export class SharedView {
  readonly soldiers: CrowdRenderer;
  readonly zombies: CrowdRenderer;
  readonly boss: CrowdRenderer;
  readonly captives: CrowdRenderer;
  readonly bullets: THREE.InstancedMesh;
  readonly effects = new Effects();
  readonly gatePanel = new THREE.BoxGeometry(CONFIG.track.gateHalfWidth * 2, 1.5, 0.12);
  readonly gatePost = new THREE.BoxGeometry(0.16, 1.9, 0.16);
  readonly gateBlue = new THREE.MeshStandardMaterial({ color: 0x3f8cff, emissive: 0x1c4bb0, transparent: true, opacity: 0.7 });
  readonly gateRed = new THREE.MeshStandardMaterial({ color: 0xff4b4b, emissive: 0x9a1515, transparent: true, opacity: 0.7 });
  readonly postMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.3, roughness: 0.5 });

  constructor(readonly assets: Assets, world: World) {
    const R = CONFIG.render;
    // Rifle held in the right hand; offsets are in the character's own units.
    const rifle = assets.rifle.scene.clone();
    rifle.scale.setScalar(1.3);
    rifle.position.set(0, -0.75, 0.25);
    rifle.rotation.set(Math.PI / 2, 0, 0);

    const legsOnly = (t: string) => t.startsWith('leg-');
    this.soldiers = new CrowdRenderer(assets.soldier, {
      height: R.soldierHeight,
      clips: [{ name: 'holding-both-shoot' }, { name: 'walk', filter: legsOnly, timeScale: 1.4 }],
      maxCount: CONFIG.squad.maxDisplayed,
      facing: Math.PI,
      attach: { node: 'arm-right', object: rifle },
    });
    this.zombies = new CrowdRenderer(assets.zombie, {
      height: R.enemyHeight,
      clips: [{ name: 'walk', timeScale: 0.8 }],
      maxCount: R.maxEnemiesRendered,
      variants: 4,
    });
    this.boss = new CrowdRenderer(assets.boss, {
      height: R.bossHeight,
      clips: [{ name: 'walk', timeScale: 0.6 }],
      maxCount: 1,
      variants: 1,
    });
    this.captives = new CrowdRenderer(assets.soldier, {
      height: R.soldierHeight,
      clips: [{ name: 'emote-yes' }],
      maxCount: 120,
      variants: 3,
    });

    this.bullets = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffd84a }),
      MAX_BULLETS,
    );
    this.bullets.frustumCulled = false;
    this.bullets.count = 0;

    for (const o of [this.soldiers.group, this.zombies.group, this.boss.group, this.captives.group, this.bullets, this.effects.group]) {
      world.scene.add(o);
    }
  }
}

interface GateView { group: THREE.Group; panel: THREE.Mesh; label: TextSprite }
interface BarrelView { group: THREE.Object3D; label: TextSprite }

/** Per-stage scene objects (gates, barrels, labels) plus syncing the shared crowds. */
export class StageView {
  private root = new THREE.Group();
  private gates: GateView[] = [];
  private barrels: BarrelView[] = [];
  private squadLabel = new TextSprite(0.8);
  private bossLabel = new TextSprite(0.9);
  private labels: TextSprite[] = [];
  private tmp = new THREE.Matrix4();
  private barrelScale: THREE.Vector3;

  constructor(private stage: Stage, private shared: SharedView, private world: World) {
    const barrelBox = new THREE.Box3().setFromObject(shared.assets.barrel.scene);
    const size = barrelBox.getSize(new THREE.Vector3());
    const B = CONFIG.barrel;
    this.barrelScale = new THREE.Vector3((B.radius * 2) / size.x, B.height / size.y, (B.radius * 2) / size.z);

    for (const g of stage.gates) this.gates.push(this.makeGate(g.x, g.z));
    for (const b of stage.barrels) this.barrels.push(this.makeBarrel(b.x, b.z));
    this.root.add(this.squadLabel.sprite, this.bossLabel.sprite);
    this.labels.push(this.squadLabel, this.bossLabel);
    this.bossLabel.sprite.visible = false;

    world.scene.add(this.root);
    world.buildTrack(stage.def.length, 77 + stage.index);
    shared.effects.clear();
  }

  private makeGate(x: number, z: number): GateView {
    const s = this.shared;
    const group = new THREE.Group();
    const panel = new THREE.Mesh(s.gatePanel, s.gateBlue);
    panel.position.y = 0.95;
    group.add(panel);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(s.gatePost, s.postMat);
      post.position.set(side * CONFIG.track.gateHalfWidth, 0.95, 0);
      group.add(post);
    }
    const label = new TextSprite(1.0);
    label.sprite.position.set(0, 1.0, 0.1);
    group.add(label.sprite);
    this.labels.push(label);
    group.position.set(x, 0, z);
    this.root.add(group);
    return { group, panel, label };
  }

  private makeBarrel(x: number, z: number): BarrelView {
    const group = new THREE.Group();
    const model = this.shared.assets.barrel.scene.clone();
    model.scale.copy(this.barrelScale);
    group.add(model);
    const label = new TextSprite(0.75);
    label.sprite.position.set(0, 0.6, CONFIG.barrel.radius + 0.05);
    group.add(label.sprite);
    this.labels.push(label);
    group.position.set(x, 0, z);
    this.root.add(group);
    return { group, label };
  }

  sync(dt: number): void {
    const st = this.stage;
    const s = this.shared;
    const squad = st.squad;

    for (const ev of st.events) {
      if (ev.type === 'blood') s.effects.blood(ev.x, ev.z);
    }
    st.events.length = 0;

    const near = (z: number) => z > squad.z - VIEW_AHEAD && z < squad.z + VIEW_BEHIND;

    // Gates: value label, color by sign, pulse on hit, vanish once passed.
    st.gates.forEach((g, i) => {
      const v = this.gates[i];
      v.group.visible = !g.used && near(g.z);
      if (!v.group.visible) return;
      const val = g.display;
      v.label.set(val >= 0 ? `+${val}` : `${val}`);
      v.panel.material = val >= 0 ? s.gateBlue : s.gateRed;
      const pulse = st.time - g.hitTime < 0.08 ? 1.06 : 1;
      v.panel.scale.set(pulse, pulse, 1);
    });

    // Barrels with captives standing on top.
    s.captives.begin();
    st.barrels.forEach((b, i) => {
      const v = this.barrels[i];
      v.group.visible = b.alive && near(b.z);
      if (!v.group.visible) return;
      v.label.set(`${b.display}`);
      const k = st.time - b.hitTime < 0.06 ? 0.95 : 1;
      v.group.scale.set(k, 1, k);
      const n = Math.min(b.reward, CONFIG.render.maxCaptivesPerBarrel);
      for (let c = 0; c < n; c++) {
        const a = (c / n) * Math.PI * 2;
        const r = n > 1 ? 0.35 : 0;
        s.captives.add(b.x + Math.cos(a) * r, CONFIG.barrel.height, b.z + Math.sin(a) * r);
      }
    });
    s.captives.update(dt);

    // Squad.
    s.soldiers.begin();
    for (const sol of squad.soldiers) s.soldiers.add(squad.x + sol.ox, 0, squad.z + sol.oz);
    s.soldiers.update(dt);
    this.squadLabel.set(`${squad.count}`, '#d6ecff');
    this.squadLabel.sprite.position.set(squad.x, 1.5, squad.z - squad.radius - 0.4);

    // Enemies, including the falling-over death animation.
    s.zombies.begin();
    for (const e of st.enemies) {
      if (e.state === 'gone' || !near(e.z)) continue;
      if (!this.addEnemy(s.zombies, e, 1)) break;
    }
    s.zombies.update(dt);

    s.boss.begin();
    const boss = st.boss;
    if (boss && boss.state !== 'gone') {
      this.addEnemy(s.boss, boss, 1);
      this.bossLabel.sprite.visible = boss.alive;
      this.bossLabel.set(`${Math.ceil(boss.hp)}`, '#ffd0d0');
      this.bossLabel.sprite.position.set(boss.x, CONFIG.render.bossHeight + 0.6, boss.z);
    } else {
      this.bossLabel.sprite.visible = false;
    }
    s.boss.update(dt);

    // Bullets, oriented along their velocity.
    const list = st.bullets.list;
    const n = Math.min(list.length, MAX_BULLETS);
    for (let i = 0; i < n; i++) {
      const b = list[i];
      this.tmp.makeRotationY(Math.atan2(b.vx, b.vz));
      this.tmp.setPosition(b.x, BULLET_Y, b.z);
      s.bullets.setMatrixAt(i, this.tmp);
    }
    s.bullets.count = n;
    s.bullets.instanceMatrix.needsUpdate = true;

    s.effects.update(dt);
    this.world.follow(squad.x, squad.z);
  }

  private addEnemy(crowd: CrowdRenderer, e: Enemy, scale: number): boolean {
    if (e.state === 'dying') {
      const t = Math.min(1, e.dieTime / CONFIG.enemy.dieTime);
      // Fall backwards (away from the squad) and sink into the ground.
      return crowd.add(e.x, -t * 0.3, e.z - t * 0.2, 0, scale, -t * Math.PI / 2);
    }
    return crowd.add(e.x, 0, e.z, 0, scale);
  }

  dispose(): void {
    this.world.scene.remove(this.root);
    for (const l of this.labels) l.dispose();
    const s = this.shared;
    for (const c of [s.soldiers, s.zombies, s.boss, s.captives]) { c.begin(); c.update(0); }
    s.bullets.count = 0;
    s.effects.clear();
  }
}
