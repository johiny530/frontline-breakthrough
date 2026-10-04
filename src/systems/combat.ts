import { CONFIG } from '../data/config';
import type { Stage } from '../core/Stage';
import type { Enemy } from '../entities/Enemy';
import { segmentHitsCircle } from './geometry';
import { tierValue } from '../entities/Squad';

const BULLET_RADIUS = 0.08;
const SPREAD_ANGLE = 0.12; // radians between fanned bullets

function pickTarget(enemies: Enemy[], sx: number, sz: number): Enemy | null {
  const { aimCone, aimSlack } = CONFIG.fire;
  let best: Enemy | null = null;
  let bestScore = Infinity;
  for (const e of enemies) {
    const ahead = sz - e.z;
    if (ahead <= 0) continue;
    const dx = Math.abs(e.x - sx);
    if (dx > aimCone * ahead + aimSlack) continue;
    const score = ahead + dx * 2; // prefer close and straight ahead
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

/** Soldiers fire; bullets fly and damage gates, barrels, enemies and the boss. */
export function updateCombat(st: Stage, dt: number): void {
  const { fire } = CONFIG;
  const squad = st.squad;
  const boss = st.boss?.alive ? st.boss : null;
  const mods = st.mods;

  const range = fire.range + mods.rangeAdd;
  const life = range / fire.bulletSpeed;
  const interval = fire.interval * mods.fireInterval;
  // Auto-aim candidates: walking enemies ahead of the squad and in range.
  const aimable = boss ? [] : st.enemies.filter((e) => e.state === 'walking' && e.z < squad.z && squad.z - e.z < range);
  let shots = 0;
  for (const u of squad.units) {
    u.fireTimer -= dt;
    if (u.fireTimer > 0) continue;
    u.fireTimer += interval;
    const sx = squad.x + u.ox;
    const sz = squad.z + u.oz - 0.3;
    let vx = 0;
    let vz = -fire.bulletSpeed;
    // Everyone focuses the boss once it shows up; otherwise aim at the nearest
    // enemy in a forward cone, or fire straight ahead (gates, barrels).
    const target = boss ?? pickTarget(aimable, sx, sz);
    if (target) {
      const dx = target.x - sx;
      const dz = target.z - sz;
      const len = Math.hypot(dx, dz) || 1;
      vx = (dx / len) * fire.bulletSpeed;
      vz = (dz / len) * fire.bulletSpeed;
    }
    // A unit fires one bullet carrying the damage of all the soldiers it stands for.
    const damage = fire.damage * tierValue(u.tier) * mods.damage;
    st.bullets.spawn(sx, sz, vx, vz, life, damage);
    // Spread perk: extra bullets fanned out at reduced damage.
    for (let k = 1; k <= mods.spread; k++) {
      for (const side of [-1, 1]) {
        const a = side * k * SPREAD_ANGLE;
        const c = Math.cos(a);
        const s = Math.sin(a);
        st.bullets.spawn(sx, sz, vx * c - vz * s, vx * s + vz * c, life, damage * 0.5);
      }
    }
    shots++;
  }
  if (shots > 0) st.events.push({ type: 'shots', count: shots });

  // Only test targets in the firing window.
  const zNear = squad.z + 2;
  const zFar = squad.z - range - 3;
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

    // Gates stop the bullet; bigger bullets pump the gate harder.
    for (const g of gates) {
      if (z0 > g.z && b.z <= g.z && Math.abs(b.x - g.x) < g.halfWidth) {
        g.hit(st.time, Math.sqrt(b.damage) * mods.gatePower);
        st.events.push({ type: 'gateHit', gate: g });
        b.damage = 0;
        break;
      }
    }

    // Barrels and enemies take what they need; the rest of the damage pierces on.
    for (const br of barrels) {
      if (b.damage <= 0) break;
      if (!br.alive || !segmentHitsCircle(x0, z0, b.x, b.z, br.x, br.z, CONFIG.barrel.radius + BULLET_RADIUS)) continue;
      const dealt = Math.min(b.damage * mods.barrelDamage, br.hp);
      br.hp -= dealt;
      b.damage -= dealt / mods.barrelDamage;
      br.hitTime = st.time;
      st.events.push({ type: 'barrelHit' });
      if (br.hp <= 0) {
        br.alive = false;
        st.score.barrelPoints += br.maxHp;
        if (br.crate) {
          st.events.push({ type: 'crateBreak', barrel: br });
        } else {
          squad.add(Math.round(br.reward * mods.rescue), br.x, br.z);
          st.events.push({ type: 'barrelBreak', barrel: br });
        }
      }
    }
    for (const e of enemies) {
      if (b.damage <= 0) break;
      if (!e.alive || !segmentHitsCircle(x0, z0, b.x, b.z, e.x, e.z, e.radius + BULLET_RADIUS)) continue;
      const mult = e.isBoss ? mods.bossDamage : 1;
      const dealt = Math.min(b.damage * mult, e.hp);
      e.hp -= dealt;
      b.damage -= dealt / mult;
      if (e.isBoss) st.events.push({ type: 'bossHit' });
      if (e.hp <= 0) {
        e.kill();
        st.score.kills++;
        st.events.push({ type: 'blood', x: e.x, z: e.z });
        st.events.push({ type: e.isBoss ? 'bossDeath' : 'kill' });
      }
    }
    if (b.damage <= 1e-6 || b.life <= 0) st.bullets.removeAt(i);
  }
}
