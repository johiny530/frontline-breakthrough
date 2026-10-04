import * as THREE from 'three';

/** Camera-facing number/text label drawn on a canvas; redraws only on change. */
export class TextSprite {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private text = '';
  private color = '';

  /** `badge` draws the text on a dark plate with an amber rim (used for the squad count). */
  constructor(height: number, private badge = false) {
    this.canvas.width = 256;
    this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: this.texture, depthTest: false, transparent: true });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.renderOrder = 10;
    this.setHeight(height);
  }

  set(text: string, color = '#ffffff'): void {
    if (text === this.text && color === this.color) return;
    this.text = text;
    this.color = color;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '68px "Black Ops One", "Arial Black", Arial, sans-serif';
    if (this.badge) {
      const w = Math.min(canvas.width - 8, ctx.measureText(text).width + 44);
      const x = (canvas.width - w) / 2;
      const c = 14; // cut corner, matching the UI plates
      ctx.beginPath();
      ctx.moveTo(x + c, 6); ctx.lineTo(x + w, 6); ctx.lineTo(x + w, 90 - c);
      ctx.lineTo(x + w - c, 90); ctx.lineTo(x, 90); ctx.lineTo(x, 6 + c); ctx.closePath();
      ctx.fillStyle = 'rgba(23, 25, 15, 0.85)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#f3a712';
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (!this.badge) {
      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(23, 25, 15, 0.9)';
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    this.texture.needsUpdate = true;
  }

  setHeight(h: number): void {
    this.sprite.scale.set(h * (256 / 96), h, 1);
  }

  dispose(): void {
    this.texture.dispose();
    this.sprite.material.dispose();
  }
}
