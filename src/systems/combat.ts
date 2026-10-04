import { CONFIG } from '../data/config';
import type { Stage } from '../core/Stage';
import type { Enemy } from '../entities/Enemy';
import { segmentHitsCircle } from './geometry';

const BULLET_RADIUS = 0.08;

/** Soldiers fire; bullets fly and damage gates, barrels, enemies and the boss. */
export function updateCombat(st: Stage, dt: number): void {
  const { fire } = CONFIG;
  const squad = st.squad;
  const boss = st.boss?.alive ? st.boss : null;

  // Each displayed soldier stands for count/displayed real soldiers.
  const damage = fire.damage * squad.count / Math.max(1, squad.displayed);
  const life = fire.range / fire.bulletSpeed;
  for (const s of squad.soldiers) {
    s.fireTimer -= dt;
    if (s.fireTimer > 0) continue;
    s.fireTimer += fire.interval;
    const sx = squad.x + s.ox;
    const sz = squad.z + s.oz - 0.3;
    let vx = 0;
    let vz = -fire.bulletSpeed;
    if (boss) {
      // Everyone focuses the boss once it shows up.
      const dx = boss.x - sx;
      const dz = boss.z - sz;
      const len = Math.hypot(dx, dz) || 1;
      vx = (dx / len) * fire.bulletSpeed;
      vz = (dz / len) * fire.bulletSpeed;
    }
    st.bullets.spawn(sx, sz, vx, vz, life, damage);
  }

  // Only test targets in the firing window.
  const zNear = squad.z + 2;
  const zFar = squad.z - fire.range - 3;
  const inWindow = (z: number) => z <= zNear && z >= zFar;
  const gates = st.gates.filter((g) => !g.used && inWindow(g.z));
  const barrels = st.barrels.filter((b) => b.alive && inWindow(b.z));
  const enemies: Enemy[] = st.enemies.filter((e) => e.alive && inWindow(e.z));
  if (boss) enemies.push(boss);

  const list = st.bullets.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    const x0 = b.x;
    const z0 = b.z;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    let hit = false;

    for (const g of gates) {
      if (z0 > g.z && b.z <= g.z && Math.abs(b.x - g.x) < g.halfWidth) {
        g.hit(st.time);
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const br of barrels) {
        if (!br.alive) continue;
        if (!segmentHitsCircle(x0, z0, b.x, b.z, br.x, br.z, CONFIG.barrel.radius + BULLET_RADIUS)) continue;
        br.hp -= b.damage;
        br.hitTime = st.time;
        if (br.hp <= 0) {
          br.alive = false;
          st.score.barrelPoints += br.maxHp;
          squad.add(br.reward, br.x, br.z);
          st.events.push({ type: 'barrelBreak', barrel: br });
        }
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (!segmentHitsCircle(x0, z0, b.x, b.z, e.x, e.z, e.radius + BULLET_RADIUS)) continue;
        e.hp -= b.damage;
        if (e.hp <= 0) {
          e.kill();
          st.score.kills++;
          st.events.push({ type: 'blood', x: e.x, z: e.z });
        }
        hit = true;
        break;
      }
    }
    if (hit || b.life <= 0) st.bullets.removeAt(i);
  }
}
