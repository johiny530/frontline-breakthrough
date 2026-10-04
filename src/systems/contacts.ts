import { CONFIG } from '../data/config';
import type { Stage } from '../core/Stage';
import { tierRadius, tierValue } from '../entities/Squad';

/** Squad touching enemies, barrels, the boss, and passing through gates. */
export function updateContacts(st: Stage, dt: number): void {
  const squad = st.squad;
  const reach = squad.radius + 1.5;

  // Sum of `weight(tier)` over units whose body touches a circle of radius r at (x, z).
  const touching = (x: number, z: number, r: number, weight: (tier: number) => number): number => {
    if (Math.abs(z - squad.z) > reach + r) return 0;
    let sum = 0;
    for (const u of squad.units) {
      const rr = r + tierRadius(u.tier);
      const dx = squad.x + u.ox - x;
      const dz = squad.z + u.oz - z;
      if (dx * dx + dz * dz < rr * rr) sum += weight(u.tier);
    }
    return sum;
  };
  const one = () => 1;

  for (const e of st.enemies) {
    if (e.state !== 'walking' || touching(e.x, e.z, e.radius, one) === 0) continue;
    // Trade one soldier per enemy hp; armor saves a fraction, carried between hits.
    st.armorAcc += Math.ceil(e.hp) * st.mods.armor;
    const lost = Math.min(squad.count, Math.floor(st.armorAcc));
    st.armorAcc -= lost;
    squad.remove(lost);
    st.events.push({ type: 'soldiersLost', count: lost });
    e.kill();
    st.events.push({ type: 'blood', x: e.x, z: e.z });
  }

  // Units pushing into a barrel lose soldiers every tick, each chipping off its hp.
  // A big unit only loses its front rank (~sqrt of its size) per tick.
  const frontRank = (tier: number) => Math.ceil(Math.sqrt(tierValue(tier)));
  for (const b of st.barrels) {
    if (!b.alive) continue;
    b.ramTimer -= dt;
    if (b.ramTimer > 0) continue;
    const pushing = touching(b.x, b.z, CONFIG.barrel.radius, frontRank);
    if (pushing === 0) continue;
    b.ramTimer = CONFIG.barrel.ramTick;
    const loss = Math.min(Math.ceil(b.hp), pushing);
    squad.remove(loss);
    st.events.push({ type: 'soldiersLost', count: loss });
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
        st.events.push({ type: 'soldiersLost', count: n });
        st.events.push({ type: 'blood', x: boss.x + (Math.random() - 0.5) * 2, z: front + 0.6 });
      }
    }
  }
}
