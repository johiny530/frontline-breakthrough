import { ENDLESS, metaStart, PERKS, RARITY_WEIGHT, type PerkDef, type RunMods } from '../../data/endless';
import { mulberry32 } from '../math';
import { Stage } from '../Stage';
import { generateSector } from './Generator';

/**
 * State of one endless run: carried-over army, perks taken, score.
 * Pure logic (no rendering), shared by the game and the balance simulator.
 */
export class EndlessRun {
  sector = 1;
  count: number;
  readonly mods: RunMods; // shared by reference with the running Stage
  readonly perkLevels = new Map<string, number>();
  rerolls: number;
  score = 0;
  kills = 0;
  sectorsCleared = 0;
  bossesKilled = 0;
  /** Perk choices owed to the player (1 per sector, 2 after a boss). */
  pendingPicks = 0;
  /** Medals already paid out (run over or abandoned). */
  settled = false;
  private rand: () => number;

  constructor(metaLevels: Record<string, number>, readonly seed = Math.floor(Math.random() * 1e9)) {
    const start = metaStart(metaLevels);
    this.mods = start.mods;
    this.count = start.startCount;
    this.rerolls = start.rerolls;
    this.pendingPicks = start.startPicks;
    this.rand = mulberry32(seed ^ 0x5bd1e995);
  }

  get isBossSector(): boolean {
    return this.sector % ENDLESS.bossEvery === 0;
  }

  createStage(): Stage {
    const def = generateSector(this.sector, this.seed, this.count);
    return new Stage(def, 100 + this.sector, this.mods);
  }

  /** Books the result of a finished sector. Returns true if the run goes on. */
  finishSector(st: Stage): boolean {
    this.kills += st.score.kills;
    this.score += st.score.kills + st.score.barrelPoints;
    if (st.status !== 'won') return false;
    const boss = st.def.boss !== undefined;
    this.count = Math.round(st.squad.count * this.mods.sectorGrowth);
    this.score += ENDLESS.sectorBonus * this.sector;
    this.sectorsCleared++;
    if (boss) this.bossesKilled++;
    this.pendingPicks += boss ? 2 : 1;
    this.sector++;
    return true;
  }

  get medals(): number {
    const base = this.sectorsCleared * ENDLESS.medalsPerSector
      + this.bossesKilled * ENDLESS.medalsPerBoss
      + Math.floor(Math.sqrt(this.score) / ENDLESS.scoreMedalDiv);
    return Math.floor(base * this.mods.medalGain);
  }

  level(perk: PerkDef): number {
    return this.perkLevels.get(perk.id) ?? 0;
  }

  /** Three distinct perks, weighted by rarity, skipping maxed ones. */
  offer(size = 3): PerkDef[] {
    const pool = PERKS.filter((p) => this.level(p) < p.maxLevel);
    const out: PerkDef[] = [];
    while (out.length < size && pool.length) {
      const total = pool.reduce((a, p) => a + RARITY_WEIGHT[p.rarity], 0);
      let r = this.rand() * total;
      const i = pool.findIndex((p) => (r -= RARITY_WEIGHT[p.rarity]) < 0);
      out.push(pool.splice(Math.max(0, i), 1)[0]);
    }
    return out;
  }

  /**
   * Takes a perk. Returns how many soldiers it adds right away (reinforcements),
   * so a running stage can add them to its squad too.
   */
  take(perk: PerkDef): number {
    this.perkLevels.set(perk.id, this.level(perk) + 1);
    perk.apply(this.mods);
    if (!perk.onPick) return 0;
    const after = perk.onPick(this.count);
    const added = after - this.count;
    this.count = after;
    return added;
  }

  /** Supply crate: a random perk applied immediately. */
  takeRandom(currentCount: number): { perk: PerkDef; added: number } {
    this.count = currentCount;
    const perk = this.offer(1)[0];
    return { perk, added: this.take(perk) };
  }

  /** Perks owned, for the pause and summary screens. */
  owned(): { perk: PerkDef; level: number }[] {
    return PERKS.filter((p) => this.level(p) > 0).map((perk) => ({ perk, level: this.level(perk) }));
  }
}
