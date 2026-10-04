const PREFS_KEY = 'frontline-breakthrough.audio.v1';

/**
 * Owns the AudioContext and the mix: master -> (sfx, music).
 * Browsers only allow sound after a user gesture, so the context is created
 * lazily and resumed on the first pointer/key press.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  private noise: AudioBuffer | null = null;
  private _muted = false;
  private musicLevel = 1;
  private readyCallbacks: (() => void)[] = [];

  constructor() {
    try {
      this._muted = localStorage.getItem(PREFS_KEY) === 'muted';
    } catch {
      // Storage unavailable: default to sound on.
    }
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get muted(): boolean {
    return this._muted;
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Runs `fn` now if audio is running, otherwise right after the first gesture. */
  whenReady(fn: () => void): void {
    if (this.ready) fn();
    else this.readyCallbacks.push(fn);
  }

  setMuted(m: boolean): void {
    this._muted = m;
    try {
      localStorage.setItem(PREFS_KEY, m ? 'muted' : 'on');
    } catch {
      // Ignore; the toggle still works for this session.
    }
    this.applyMaster();
  }

  /** Music volume multiplier, e.g. ducked while paused. */
  setMusicLevel(level: number): void {
    this.musicLevel = level;
    if (this.ctx) this.music.gain.setTargetAtTime(0.24 * level, this.ctx.currentTime, 0.15);
  }

  private unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.connect(comp);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 1.4;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.24 * this.musicLevel;
      this.music.connect(this.master);
      this.applyMaster();
    }
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().then(() => this.flushReady());
    } else {
      this.flushReady();
    }
  }

  private flushReady(): void {
    const cbs = this.readyCallbacks;
    this.readyCallbacks = [];
    for (const cb of cbs) cb();
  }

  private applyMaster(): void {
    if (this.ctx) this.master.gain.setTargetAtTime(this._muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /** One second of white noise, shared by every noise-based sound. */
  noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const ctx = this.ctx!;
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
