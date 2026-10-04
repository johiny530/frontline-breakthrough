import * as THREE from 'three';
import { CONFIG } from '../data/config';
import { Stage } from '../core/Stage';
import { LEVELS } from '../data/levels';
import type { Enemy } from '../entities/Enemy';
import type { Assets } from './Assets';
import { CrowdRenderer } from './CrowdRenderer';
import { Debris } from './Debris';
import { Effects } from './Effects';
import { TextSprite } from './TextSprite';
import type { World } from './World';

const MAX_BULLETS = 1200;
const BULLET_Y = 0.45;
const VIEW_AHEAD = 60;
const VIEW_BEHIND = 8;
const FLOAT_LIFE = 1.1;

/** Renderers that live for the whole session and are reused by every stage. */
export class SharedView {
  readonly ranks: CrowdRenderer[]; // one crowd per squad tier
  readonly zombies: CrowdRenderer;
  readonly boss: CrowdRenderer;
  readonly captives: CrowdRenderer;
  readonly bullets: THREE.InstancedMesh;
  readonly effects = new Effects();
  readonly debris = new Debris();
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
    const rankModels = [assets.soldier, assets.officer, assets.elite, assets.mech, assets.mech];
    const tiers = CONFIG.squad.tiers;
    this.ranks = tiers.map((tier, i) => new CrowdRenderer(rankModels[i], {
      height: tier.height,
      clips: [{ name: 'holding-both-shoot' }, { name: 'walk', filter: legsOnly, timeScale: 1.4 }],
      maxCount: i === tiers.length - 1 ? 60 : 9, // lower ranks merge at 10
      variants: 2,
      facing: Math.PI,
      attach: { node: 'arm-right', object: rifle },
    }));
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

    for (const o of [...this.ranks.map((r) => r.group), this.zombies.group, this.boss.group, this.captives.group, this.bullets, this.effects.group, this.debris.group]) {
      world.scene.add(o);
    }
  }
}

/**
 * Draws one of everything once (off to the side) so every shader is compiled
 * during loading. Instanced meshes with zero instances are skipped by the
 * renderer, so a plain renderer.compile() would miss them.
 */
export function warmUp(shared: SharedView, world: World): void {
  const st = new Stage(LEVELS[0], 0);
  const view = new StageView(st, shared, world);
  view.sync(0);
  for (const c of [...shared.ranks, shared.zombies, shared.boss, shared.captives]) {
    c.begin();
    c.add(0, 0, 4);
    c.update(0);
  }
  shared.bullets.count = 1;
  shared.debris.burst(0, 1, 4, 0xffffff, 1);
  shared.debris.update(0.01);
  shared.effects.blood(0, 4);
  shared.effects.update(0.01);
  world.follow(0, 0);
  world.render();
  view.dispose();
}

interface GateView { group: THREE.Group; panel: THREE.Mesh; label: TextSprite }
interface BarrelView { group: THREE.Object3D; label: TextSprite }

/** Per-stage scene objects (gates, barrels, labels) plus syncing the shared crowds. */
export class StageView {
  private root = new THREE.Group();
  private gates: GateView[] = [];
  private barrels: BarrelView[] = [];
  private squadLabel = new TextSprite(0.8, true);
  private bossLabel = new TextSprite(0.9);
  private labels: TextSprite[] = [];
  private floaters: { label: TextSprite; life: number }[] = [];
  private tmp = new THREE.Matrix4();
  private scaleTmp = new THREE.Matrix4();
  private barrelScale: THREE.Vector3;

  constructor(private stage: Stage, private shared: SharedView, private world: World) {
    const barrelBox = new THREE.Box3().setFromObject(shared.assets.barrel.scene);
    const size = barrelBox.getSize(new THREE.Vector3());
    const B = CONFIG.barrel;
    this.barrelScale = new THREE.Vector3((B.radius * 2) / size.x, B.height / size.y, (B.radius * 2) / size.z);

    for (const g of stage.gates) this.gates.push(this.makeGate(g.x, g.z));
    for (const b of stage.barrels) this.barrels.push(this.makeBarrel(b.x, b.z, b.crate));
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

  private makeBarrel(x: number, z: number, crate: boolean): BarrelView {
    const group = new THREE.Group();
    if (crate) {
      // Supply crate: a chest sized like a barrel, with an amber marker.
      const model = this.shared.assets.crate.scene.clone();
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.setScalar((CONFIG.barrel.radius * 2.2) / Math.max(size.x, size.z));
      group.add(model);
      const tag = new TextSprite(0.6);
      tag.set('SUPPLY', '#f3a712');
      tag.sprite.position.set(0, 2.0, 0);
      group.add(tag.sprite);
      this.labels.push(tag);
    } else {
      const model = this.shared.assets.barrel.scene.clone();
      model.scale.copy(this.barrelScale);
      group.add(model);
    }
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

    let lost = 0;
    for (const ev of st.events) {
      switch (ev.type) {
        case 'blood': s.effects.blood(ev.x, ev.z); break;
        case 'barrelBreak':
          s.debris.burst(ev.barrel.x, 0.6, ev.barrel.z, 0x9a5a2c, 18);
          this.world.shake(0.25);
          if (ev.freed > 0) this.floater(`+${ev.freed}`, '#9fe870', ev.barrel.x, 2, ev.barrel.z);
          break;
        case 'crateBreak':
          s.debris.burst(ev.barrel.x, 0.6, ev.barrel.z, 0xf3a712, 22, 1.2);
          this.world.shake(0.3);
          break;
        case 'gatePass':
          if (ev.delta !== 0) {
            this.floater(ev.delta > 0 ? `+${ev.delta}` : `${ev.delta}`, ev.delta > 0 ? '#8fc8ff' : '#ff7a6a',
              squad.x + 1.4, 3.4, squad.z - squad.radius);
          }
          break;
        case 'soldiersLost': lost += ev.count; break;
        case 'bossDeath':
          if (st.boss) s.debris.burst(st.boss.x, 1.5, st.boss.z, 0x4f9a6a, 60, 1.6);
          this.world.shake(1);
          break;
      }
    }
    // Shake in proportion to the share of the army lost this frame.
    if (lost > 0) this.world.shake(Math.min(0.5, (lost / Math.max(10, squad.count + lost)) * 3));
    st.events.length = 0;
    this.updateFloaters(dt);

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
    for (const r of s.ranks) r.begin();
    let tallest = 0;
    for (const u of squad.units) {
      s.ranks[u.tier].add(squad.x + u.ox, 0, squad.z + u.oz);
      tallest = Math.max(tallest, CONFIG.squad.tiers[u.tier].height);
    }
    for (const r of s.ranks) r.update(dt);
    this.squadLabel.set(`${squad.count}`, '#f4f1e6');
    this.squadLabel.sprite.position.set(squad.x, tallest + 0.5, squad.z - squad.radius - 0.4);

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
      // Heavier (higher-rank) bullets are drawn thicker.
      const k = 1 + 0.6 * Math.log10(Math.max(1, b.damage));
      this.tmp.makeRotationY(Math.atan2(b.vx, b.vz));
      this.tmp.multiply(this.scaleTmp.makeScale(k, k, 1));
      this.tmp.setPosition(b.x, BULLET_Y, b.z);
      s.bullets.setMatrixAt(i, this.tmp);
    }
    s.bullets.count = n;
    s.bullets.instanceMatrix.needsUpdate = true;

    s.effects.update(dt);
    s.debris.update(dt);
    this.world.follow(squad.x, squad.z, squad.radius);
  }

  /** Rising, fading number (gate gains, rescued soldiers). */
  private floater(text: string, color: string, x: number, y: number, z: number): void {
    let f = this.floaters.find((f) => f.life <= 0);
    if (!f) {
      f = { label: new TextSprite(0.9), life: 0 };
      this.labels.push(f.label);
      this.root.add(f.label.sprite);
      this.floaters.push(f);
    }
    f.label.set(text, color);
    f.label.sprite.position.set(x, y, z);
    f.label.sprite.visible = true;
    f.life = FLOAT_LIFE;
  }

  private updateFloaters(dt: number): void {
    for (const f of this.floaters) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.label.sprite.position.y += dt * 1.6;
      f.label.sprite.material.opacity = Math.min(1, f.life / (FLOAT_LIFE * 0.4));
      if (f.life <= 0) f.label.sprite.visible = false;
    }
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
    for (const c of [...s.ranks, s.zombies, s.boss, s.captives]) { c.begin(); c.update(0); }
    s.bullets.count = 0;
    s.effects.clear();
    s.debris.clear();
  }
}
