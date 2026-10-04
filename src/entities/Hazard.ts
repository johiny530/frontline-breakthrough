/** Spike strip across part of the road. Bullets pass over it; only steering avoids it. */
export class Hazard {
  tickTimer = 0;

  constructor(
    public x: number,
    public z: number,
    public halfWidth: number,
    public halfDepth: number,
  ) {}
}
