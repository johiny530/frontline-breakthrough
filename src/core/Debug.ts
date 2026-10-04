import type { LevelDef } from '../data/levels';
import { Stage } from './Stage';

// URL flags for testing: ?stage=3 starts a stage directly, ?bot=1 lets a simple
// autopilot steer, ?ts=4 speeds up time. Results are logged with a [FB] prefix.
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const DEBUG = {
  stage: params.has('stage') ? Math.max(0, Number(params.get('stage')) - 1) : null,
  bot: params.get('bot') === '1',
  timeScale: Number(params.get('ts')) || 1,
  report(st: Stage): void {
    if (!this.bot && this.stage === null) return;
    console.info(`[FB] stage ${st.index + 1} ${st.status} soldiers=${st.squad.count} ` +
      `kills=${st.score.kills} barrels=${st.score.barrelPoints} total=${st.total} t=${st.time.toFixed(1)}s`);
  },
};

/**
 * Rough "average player" autopilot for balance testing:
 * shoot barrels it can break, pick the better gate, dodge barrels about to be rammed.
 */
export class Bot {
  targetX(st: Stage): number {
    const squad = st.squad;
    let x = 0;

    // Nearest gate row within reach: remember its best gate.
    let rowZ: number | null = null;
    let best: { x: number; value: number } | null = null;
    for (const g of st.gates) {
      const ahead = squad.z - g.z;
      if (g.used || ahead < 0 || ahead > 18) continue;
      if (rowZ === null || g.z > rowZ + 1) { rowZ = g.z; best = null; }
      if (Math.abs(g.z - rowZ) > 1) continue;
      if (!best || g.value > best.value) best = { x: g.x, value: g.value };
    }

    // Shoot the weakest breakable barrel if it comes before the gate row.
    let target: { x: number; z: number; hp: number } | null = null;
    for (const b of st.barrels) {
      const ahead = squad.z - b.z;
      if (!b.alive || ahead < 3 || ahead > 16 || b.hp > squad.count * 2.5) continue;
      if (!target || b.hp < target.hp) target = { x: b.x, z: b.z, hp: b.hp };
    }
    if (target && (rowZ === null || target.z > rowZ)) x = target.x;
    // The gap between the two lane gates (x = 0) passes neither of them.
    else if (best) x = best.value > 0 ? best.x : 0;

    for (const b of st.barrels) {
      const ahead = squad.z - b.z;
      if (b.alive && ahead > 0 && ahead < 3 && Math.abs(x - b.x) < 2) x = b.x > 0 ? b.x - 3.5 : b.x + 3.5;
    }
    return x;
  }
}

/**
 * Headless balance test: plays every level with the bot at 60 steps/s and
 * summarizes the result (soldier count every 2 s). No rendering involved.
 */
export function simulateAll(levels: LevelDef[]): string {
  const out: string[] = [];
  const bot = new Bot();
  const dt = 1 / 60;
  levels.forEach((def, i) => {
    const st = new Stage(def, i);
    const counts: number[] = [];
    for (let f = 0; f < 60 * 180 && st.status === 'playing'; f++) {
      st.squad.targetX = bot.targetX(st);
      st.update(dt);
      st.events.length = 0;
      if (f % 120 === 0) counts.push(st.squad.count);
    }
    out.push(`S${i + 1} ${st.status} t=${st.time.toFixed(0)} count=${st.squad.count} kills=${st.score.kills} ` +
      `barrels=${st.score.barrelPoints} total=${st.total} boss=${st.boss ? Math.ceil(st.boss.hp) : '-'} | ${counts.join(',')}`);
  });
  return out.join('\n');
}
