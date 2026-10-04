// Global tuning constants. Per-level content lives in levels.ts.
// World units: 1 unit ~ 1 m. The squad runs toward -Z.

export const CONFIG = {
  track: {
    halfWidth: 4,
    laneX: 2, // x of the left/right lane centers
    gateHalfWidth: 1.8,
  },
  squad: {
    forwardSpeed: 4,
    steerSpeed: 9, // keyboard steering, units/s
    dragGain: 1.3, // drag distance multiplier (pointer)
    followRate: 14, // how fast the squad center chases its target x
    // Rank system: every 10 units of one tier merge into one unit of the next.
    // The last tier never merges. radius is the collision/packing radius.
    tiers: [
      { value: 1, radius: 0.22, height: 1.05 },
      { value: 10, radius: 0.3, height: 1.45 },
      { value: 100, radius: 0.4, height: 1.9 },
      { value: 1000, radius: 0.5, height: 2.4 },
      { value: 10000, radius: 0.62, height: 3.0 },
    ],
    packing: 1.5, // formation area per unit, relative to (2 * radius)^2
    slotFollowRate: 6, // how fast units move to their formation slots
  },
  fire: {
    interval: 0.6, // seconds between shots per unit
    bulletSpeed: 30,
    range: 16,
    damage: 1, // per bullet per soldier: a unit worth 10 fires 10-damage bullets
    // Bullets pierce: damage left over after killing a target carries on.
    aimCone: 0.45, // soldiers auto-aim at enemies within |dx| < aimCone * distance + aimSlack
    aimSlack: 0.6,
  },
  // Enemy kinds: speed multiplies walkSpeed; radius is the body size;
  // spacing is the gap between them in a group.
  enemyTypes: {
    walker: { speed: 1, radius: 0.36, spacing: 0.75 },
    runner: { speed: 2.1, radius: 0.32, spacing: 0.7 },
    brute: { speed: 0.6, radius: 0.62, spacing: 1.4 },
  },
  enemy: {
    radius: 0.36,
    walkSpeed: 2.2,
    activateDist: 26, // enemies start walking when this close
    chaseRate: 0.8, // lateral speed toward the squad, units/s
    chaseSpread: 0.7, // fraction of its group offset an enemy keeps while chasing
    dieTime: 0.45,
    despawnBehind: 6,
  },
  barrel: {
    radius: 0.7,
    height: 1.3,
    ramTick: 0.1, // seconds between losses while soldiers push into a barrel
    ramShare: 0.15, // share of a touching unit's soldiers lost per tick
  },
  hazard: {
    halfDepth: 0.5,
    tick: 0.1, // seconds between losses while units stand on spikes
    share: 0.3, // share of a touching unit's soldiers lost per tick
  },
  boss: {
    radius: 1.1,
    spawnAhead: 17,
  },
  score: {
    kill: 1,
    survivor: 5,
  },
  render: {
    soldierHeight: 1.05,
    enemyHeight: 1.05,
    bossHeight: 3.2,
    maxEnemiesRendered: 300,
    maxCaptivesPerBarrel: 6,
  },
  camera: {
    fov: 64,
    height: 8.5,
    back: 7,
    lookAhead: 9,
    followX: 0.35,
    pullStart: 1.5, // squad radius where the camera starts pulling back
    pullHeight: 1.2,
    pullBack: 1.4,
  },
} as const;
