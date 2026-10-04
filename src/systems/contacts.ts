import { CONFIG } from '../data/config';
import type { Stage } from '../core/Stage';

/** Squad touching enemies, barrels, the boss, and passing through gates. */
export function updateContacts(st: Stage, dt: number): void {
  const squad = st.squad;
  const sr = CONFIG.squad.soldierRadius;
  const reach = squad.radius + 1.5;

  // Number of displayed soldiers within r of (x, z).
  const countTouching = (x: number, z: number, r: number): number => {
    if (Math.abs(z - squad.z) > reach + r) return 0;
    const rr = (r + sr) * (r + sr);
    let n = 0;
    for (const s of squad.soldiers) {
      const dx = squad.x + s.ox - x;
      const dz = squad.z + s.oz - z;
      if (dx * dx + dz * dz < rr) n++;
    }
    return n;
  };

  for (const e of st.enemies) {
    if (e.state !== 'walking' || countTouching(e.x, e.z, e.radius) === 0) continue;
    squad.remove(Math.ceil(e.hp)); // trade one soldier per enemy hp
    e.kill();
    st.events.push({ type: 'blood', x: e.x, z: e.z });
  }

  // Soldiers that run into a barrel die one by one, each chipping off its hp.
  const perSoldier = squad.count / Math.max(1, squad.displayed);
  for (const b of st.barrels) {
    if (!b.alive) continue;
    b.ramTimer -= dt;
    if (b.ramTimer > 0) continue;
    const touching = countTouching(b.x, b.z, CONFIG.barrel.radius);
    if (touching === 0) continue;
    b.ramTimer = CONFIG.barrel.ramTick;
    const loss = Math.min(Math.ceil(b.hp), Math.ceil(touching * perSoldier));
    squad.remove(loss);
    b.hp -= loss;
    b.hitTime = st.time;
    st.events.push({ type: 'blood', x: b.x, z: b.z + CONFIG.barrel.radius });
    if (b.hp <= 0) {
      b.alive = false; // destroyed by ramming: no reward
      st.events.push({ type: 'barrelBreak', barrel: b });
    }
  }

  for (const g of st.gates) {
    if (g.used || squad.z > g.z) continue;
    g.used = true;
    if (Math.abs(squad.x - g.x) >= g.halfWidth) continue;
    const delta = g.display;
    if (delta > 0) squad.add(delta, g.x, g.z);
    else squad.remove(-delta);
    st.events.push({ type: 'gatePass', gate: g, delta });
  }

  const boss = st.boss;
  const bossDef = st.def.boss;
  if (boss?.alive && bossDef) {
    const front = squad.z - squad.radius - boss.radius;
    if (boss.z >= front - 0.05) {
      st.bossContactAcc += bossDef.contactDps * dt;
      const n = Math.floor(st.bossContactAcc);
      if (n > 0) {
        st.bossContactAcc -= n;
        squad.remove(n);
        st.events.push({ type: 'blood', x: boss.x + (Math.random() - 0.5) * 2, z: front + 0.6 });
      }
    }
  }
}
