export class Barrel {
  alive = true;
  hitTime = -1;
  ramTimer = 0;
  hp: number;

  constructor(
    public x: number,
    public z: number,
    public maxHp: number,
    public reward: number,
    public crate = false,
  ) {
    this.hp = maxHp;
  }

  get display(): number {
    return Math.ceil(this.hp);
  }
}
