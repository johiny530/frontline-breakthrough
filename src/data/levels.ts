// Level content. `at` is the distance from the start line (world z = -at).
// Tune difficulty here; game code reads these definitions only.

export type Lane = 'left' | 'right' | 'center';

export interface GateDef {
  kind: 'gate';
  at: number;
  lane: Lane;
  value: number; // soldiers added when passing (negative removes)
  perHit: number; // value gained per bullet hit
  max: number;
}

export interface BarrelDef {
  kind: 'barrel';
  at: number;
  x: number;
  hp: number;
  reward: number; // soldiers that join when the barrel breaks
}

export interface EnemyGroupDef {
  kind: 'enemies';
  at: number;
  x: number;
  count: number;
  hp: number;
  spread: number; // half width of the group
}

export type ItemDef = GateDef | BarrelDef | EnemyGroupDef;

export interface BossDef {
  hp: number;
  speed: number;
  contactDps: number; // soldiers lost per second while touching the squad
}

export interface LevelDef {
  name: string;
  length: number;
  startSoldiers: number;
  items: ItemDef[];
  boss?: BossDef;
}

// Small builders to keep the tables short.
const gate = (at: number, lane: Lane, value: number, perHit = 0.15, max = 40): GateDef =>
  ({ kind: 'gate', at, lane, value, perHit, max });
const barrel = (at: number, x: number, hp: number, reward: number): BarrelDef =>
  ({ kind: 'barrel', at, x, hp, reward });
const enemies = (at: number, x: number, count: number, hp = 1, spread = 3.2): EnemyGroupDef =>
  ({ kind: 'enemies', at, x, count, hp, spread });

export const LEVELS: LevelDef[] = [
  {
    name: '沙漠公路',
    length: 150,
    startSoldiers: 10,
    items: [
      gate(16, 'left', -5), gate(16, 'right', 5),
      enemies(34, 0, 30),
      barrel(52, -2, 30, 8), barrel(52, 2, 45, 15),
      gate(72, 'left', 0), gate(72, 'right', -8, 0.3),
      enemies(92, 0, 70),
      barrel(112, 0, 80, 20),
      enemies(132, 0, 90),
    ],
  },
  {
    name: '廢棄檢查站',
    length: 170,
    startSoldiers: 10,
    items: [
      gate(16, 'left', 8), gate(16, 'right', -10, 0.3),
      enemies(32, 0, 40),
      barrel(50, -2, 50, 15), barrel(50, 2, 30, 6),
      gate(70, 'left', -15, 0.4, 50), gate(70, 'right', 5),
      enemies(90, 0, 60, 2),
      barrel(110, -2, 90, 25), gate(110, 'right', 3),
      enemies(130, 0, 100, 2),
      enemies(152, 0, 80, 3),
    ],
  },
  {
    name: '前線補給線',
    length: 190,
    startSoldiers: 12,
    items: [
      gate(16, 'left', -10, 0.35, 50), gate(16, 'right', 4),
      enemies(32, 0, 45),
      barrel(48, -2, 60, 18), barrel(48, 2, 90, 30),
      enemies(66, -2, 45, 1, 1.8), enemies(66, 2, 45, 1, 1.8),
      gate(86, 'left', 10), gate(86, 'right', -20, 0.5, 60),
      barrel(104, 0, 100, 40),
      enemies(124, 0, 70, 2),
      gate(142, 'left', -5, 0.3, 40), gate(142, 'right', -5, 0.3, 40),
      enemies(162, 0, 60, 2),
      barrel(178, -2, 120, 10), barrel(178, 2, 120, 10),
    ],
  },
  {
    name: '焦土峽谷',
    length: 210,
    startSoldiers: 12,
    items: [
      gate(16, 'left', 6), gate(16, 'right', 6),
      enemies(30, 0, 50),
      barrel(46, -2, 70, 30), gate(46, 'right', -10, 0.4, 50),
      enemies(64, 0, 60, 2),
      gate(84, 'left', -25, 0.7, 80), gate(84, 'right', 10),
      barrel(100, 2, 110, 45), enemies(100, -2, 30, 2, 1.6),
      enemies(120, 0, 90, 2),
      barrel(136, -2, 140, 40), barrel(146, 2, 140, 40),
      enemies(160, 0, 80, 3),
      gate(178, 'left', 0, 0.5, 60), gate(178, 'right', -15, 0.5, 60),
      enemies(196, 0, 120, 2),
    ],
  },
  {
    name: '最終突破',
    length: 200,
    startSoldiers: 15,
    items: [
      gate(16, 'left', -10, 0.5, 60), gate(16, 'right', 10),
      enemies(32, 0, 60),
      barrel(48, -2, 70, 35), barrel(58, 2, 110, 50),
      enemies(72, 0, 70, 2),
      gate(90, 'left', 15), gate(90, 'right', -30, 0.8, 100),
      barrel(108, 0, 140, 60),
      enemies(128, -2, 50, 3, 1.6), enemies(128, 2, 50, 3, 1.6),
      gate(148, 'left', -10, 0.6, 80), gate(148, 'right', -10, 0.6, 80),
      enemies(166, 0, 120, 2),
      barrel(184, -2, 180, 50), barrel(184, 2, 180, 50),
    ],
    boss: { hp: 9000, speed: 1, contactDps: 15 },
  },
];

export function laneX(lane: Lane, laneOffset: number): number {
  return lane === 'left' ? -laneOffset : lane === 'right' ? laneOffset : 0;
}
