import { CONFIG } from '../data/config';
import type { Stage } from '../core/Stage';
import { clamp } from '../core/math';
import type { Enemy } from '../entities/Enemy';

function tickDying(e: Enemy, dt: number): void {
  e.dieTime += dt;
  if (e.dieTime >= CONFIG.enemy.dieTime) e.state = 'gone';
}

/** Enemy movement: wake up when close, walk toward the squad, drift sideways to chase. */
export function updateEnemies(st: Stage, dt: number): void {
  const cfg = CONFIG.enemy;
  const squad = st.squad;

  for (const e of st.enemies) {
    if (e.state === 'dying') { tickDying(e, dt); continue; }
    if (!e.alive) continue;
    const ahead = squad.z - e.z;
    if (e.state === 'idle' && ahead < cfg.activateDist) e.state = 'walking';
    if (e.state !== 'walking') continue;
    e.z += cfg.walkSpeed * CONFIG.enemyTypes[e.type].speed * dt;
    // Chase the squad but keep the group's spread, so enemies don't pile into one column.
    const edge = CONFIG.track.halfWidth - e.radius;
    const target = clamp(squad.x + e.laneOffset * cfg.chaseSpread, -edge, edge);
    const step = cfg.chaseRate * dt;
    e.x += clamp(target - e.x, -step, step);
    if (e.z > squad.z + cfg.despawnBehind) e.state = 'gone';
  }

  const boss = st.boss;
  const bossDef = st.def.boss;
  if (boss && bossDef) {
    if (boss.state === 'dying') tickDying(boss, dt);
    else if (boss.alive) {
      const front = squad.z - squad.radius - boss.radius;
      if (boss.z < front) boss.z = Math.min(front, boss.z + bossDef.speed * dt);
      const step = 0.6 * dt;
      boss.x += clamp(squad.x - boss.x, -step, step);
    }
  }
}
