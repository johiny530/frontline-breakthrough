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
    spacing: 0.36, // formation spacing between soldiers
    maxDisplayed: 150, // soldiers rendered; the real count can be larger
    soldierRadius: 0.26,
    slotFollowRate: 6, // how fast soldiers move to their formation slots
  },
  fire: {
    interval: 0.6, // seconds between shots per displayed soldier
    bulletSpeed: 30,
    range: 16,
    damage: 1, // per bullet, multiplied by count / displayed
    aimCone: 0.45, // soldiers auto-aim at enemies within |dx| < aimCone * distance + aimSlack
    aimSlack: 0.6,
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
