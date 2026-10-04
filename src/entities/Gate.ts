export type GateOp = 'add' | 'mul';

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
    public op: GateOp = 'add', // add: +value soldiers; mul: x value soldiers
  ) {}

  /** Soldiers this gate would add (negative = remove) for an army of `count`. */
  gain(count: number): number {
    if (this.op === 'mul') return Math.round(count * this.multiplier) - count;
    return Math.floor(this.value);
  }

  /** Multiplier gates snap to one decimal, which is also what the label shows. */
  get multiplier(): number {
    return Math.floor(this.value * 10 + 1e-6) / 10;
  }

  get good(): boolean {
    return this.op === 'mul' ? this.multiplier > 1 : Math.floor(this.value) >= 0;
  }

  /** Text on the gate: "+12", "-5", "x1.5". */
  get label(): string {
    if (this.op === 'mul') return `×${this.multiplier.toFixed(1)}`;
    const v = Math.floor(this.value);
    return v >= 0 ? `+${v}` : `${v}`;
  }

  hit(time: number, power = 1): void {
    this.value = Math.min(this.max, this.value + this.perHit * power);
    this.hitTime = time;
  }
}
