export type EnemyState = 'idle' | 'walking' | 'dying' | 'gone';

export class Enemy {
  state: EnemyState = 'idle';
  hp: number;
  dieTime = 0; // seconds spent dying
  laneOffset = 0; // x offset inside its group, kept while chasing

  constructor(
    public x: number,
    public z: number,
    public maxHp: number,
    public radius: number,
    public isBoss = false,
  ) {
    this.hp = maxHp;
  }

  get alive(): boolean {
    return this.state === 'idle' || this.state === 'walking';
  }

  kill(): void {
    this.hp = 0;
    this.state = 'dying';
    this.dieTime = 0;
  }
}
