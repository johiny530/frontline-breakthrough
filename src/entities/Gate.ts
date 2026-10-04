export class Gate {
  used = false;
  hitTime = -1; // stage time of the last bullet hit, for feedback

  constructor(
    public x: number,
    public z: number,
    public halfWidth: number,
    public value: number,
    public perHit: number,
    public max: number,
  ) {}

  /** Value shown on the gate and applied when passing. */
  get display(): number {
    return Math.floor(this.value);
  }

  hit(time: number, power = 1): void {
    this.value = Math.min(this.max, this.value + this.perHit * power);
    this.hitTime = time;
  }
}
