/** Pointer drag (mouse/touch) and keyboard steering. */
export class Input {
  private dragPx = 0;
  private lastX: number | null = null;
  private keys = new Set<string>();
  onPause: (() => void) | null = null;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      if (e.target !== el && !(e.target instanceof HTMLCanvasElement)) return;
      this.lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (this.lastX === null) return;
      this.dragPx += e.clientX - this.lastX;
      this.lastX = e.clientX;
    });
    const end = () => { this.lastX = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Horizontal drag since the last call, as a fraction of the element width. */
  consumeDrag(): number {
    const w = this.el.clientWidth || 1;
    const d = this.dragPx / w;
    this.dragPx = 0;
    return d;
  }

  /** Keyboard axis: -1 left, +1 right. */
  get axis(): number {
    let a = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) a -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) a += 1;
    return a;
  }
}
