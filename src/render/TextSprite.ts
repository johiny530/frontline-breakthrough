import * as THREE from 'three';

/** Camera-facing number/text label drawn on a canvas; redraws only on change. */
export class TextSprite {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private text = '';
  private color = '';

  constructor(height: number) {
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
    ctx.font = 'bold 72px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(20, 20, 30, 0.9)';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
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
