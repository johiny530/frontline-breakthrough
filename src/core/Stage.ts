import { CONFIG } from '../data/config';
import { laneX, type LevelDef } from '../data/levels';
import { Barrel } from '../entities/Barrel';
import { Bullets } from '../entities/Bullets';
import { Enemy } from '../entities/Enemy';
import { Gate } from '../entities/Gate';
import { Squad } from '../entities/Squad';
import { mulberry32 } from './math';
import { IDENTITY_MODS, type RunMods } from '../data/endless';
import { updateCombat } from '../systems/combat';
import { updateContacts } from '../systems/contacts';
import { updateEnemies } from '../systems/enemies';

export type StageStatus = 'playing' | 'won' | 'lost';

export type StageEvent =
  | { type: 'blood'; x: number; z: number }
  | { type: 'barrelBreak'; barrel: Barrel; freed: number } // freed = soldiers rescued
  | { type: 'crateBreak'; barrel: Barrel }
  | { type: 'gatePass'; gate: Gate; delta: number }
  | { type: 'bossSpawn'; boss: Enemy }
  // Audio-oriented events (no positions needed).
  | { type: 'shots'; count: number }
  | { type: 'kill' }
  | { type: 'gateHit'; gate: Gate }
  | { type: 'barrelHit' }
  | { type: 'soldiersLost'; count: number }
  | { type: 'bossHit' }
  | { type: 'bossDeath' };

export interface ScoreSheet {
  kills: number;
  barrelPoints: number;
  survivorBonus: number;
}

/**
 * Pure game state for one level. Has no rendering code, so it can run headless
 * (e.g. for balance testing). The view reads it and the `events` queue each frame.
 */
export class Stage {
  readonly squad: Squad;
  readonly gates: Gate[] = [];
  readonly barrels: Barrel[] = [];
  readonly enemies: Enemy[] = [];
  readonly bullets = new Bullets();
  readonly events: StageEvent[] = [];
  readonly score: ScoreSheet = { kills: 0, barrelPoints: 0, survivorBonus: 0 };

  boss: Enemy | null = null;
  progress = 0;
  time = 0;
  status: StageStatus = 'playing';
  bossContactAcc = 0;

  /** Bookkeeping for armor: fractional soldiers saved so far. */
  armorAcc = 0;

  constructor(readonly def: LevelDef, readonly index: number, readonly mods: RunMods = IDENTITY_MODS) {
    this.squad = new Squad(def.startSoldiers);
    const rand = mulberry32(1000 + index);
    const { laneX: lx, gateHalfWidth } = CONFIG.track;

    for (const item of def.items) {
      const z = -item.at;
      if (item.kind === 'gate') {
        this.gates.push(new Gate(laneX(item.lane, lx), z, gateHalfWidth, item.value, item.perHit, item.max));
      } else if (item.kind === 'barrel') {
        this.barrels.push(new Barrel(item.x, z, item.hp, item.reward, item.crate));
      } else {
        // Scatter the group in a loose grid around (x, z).
        const cols = Math.max(1, Math.round(item.spread * 2 / 0.75));
        for (let i = 0; i < item.count; i++) {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const ex = item.x - item.spread + (c + 0.5) * (item.spread * 2 / cols) + (rand() - 0.5) * 0.3;
          const ez = z - r * 0.75 + (rand() - 0.5) * 0.3;
          const e = new Enemy(ex, ez, item.hp, CONFIG.enemy.radius);
          e.laneOffset = ex - item.x;
          this.enemies.push(e);
        }
      }
    }
  }

  get total(): number {
    return this.score.kills * CONFIG.score.kill + this.score.barrelPoints + this.score.survivorBonus;
  }

  /** Enemies still standing (for the HUD). */
  get enemiesLeft(): number {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    if (this.boss?.alive) n++;
    return n;
  }

  update(dt: number): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    const squad = this.squad;

    // Advance unless a boss blocks the way.
    const bossBlocking = this.boss !== null && this.boss.alive;
    if (!bossBlocking) {
      this.progress = Math.min(this.def.length, this.progress + CONFIG.squad.forwardSpeed * dt);
    }
    squad.z = -this.progress;
    squad.update(dt);

    if (this.progress >= this.def.length) {
      if (this.def.boss && !this.boss) {
        const b = this.def.boss;
        this.boss = new Enemy(0, squad.z - CONFIG.boss.spawnAhead, b.hp, CONFIG.boss.radius, true);
        this.boss.state = 'walking';
        this.events.push({ type: 'bossSpawn', boss: this.boss });
      } else if (!this.def.boss || (this.boss && !this.boss.alive)) {
        this.finish(true);
        return;
      }
    }

    updateCombat(this, dt);
    updateEnemies(this, dt);
    updateContacts(this, dt);

    if (squad.count <= 0) this.finish(false);
  }

  private finish(won: boolean): void {
    this.status = won ? 'won' : 'lost';
    if (won) this.score.survivorBonus = this.squad.count * CONFIG.score.survivor;
  }
}
