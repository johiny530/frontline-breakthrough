import { midiToHz, type AudioEngine } from './AudioEngine';
import { noise, tone } from './synth';

// Every sound effect is synthesized; no audio files ship with the game.
// `intensity` (0..1) scales loudness for sounds that fire in bursts.

export type SfxName =
  | 'shot' | 'kill' | 'gateHit' | 'gateGood' | 'gateBad'
  | 'barrelHit' | 'barrelBreak' | 'soldierLost'
  | 'bossSpawn' | 'bossHit' | 'bossDeath'
  | 'win' | 'lose' | 'click' | 'perk';

type SfxFn = (eng: AudioEngine, out: AudioNode, t: number, intensity: number, pitch: number) => void;

const SFX: Record<SfxName, SfxFn> = {
  shot(e, out, t, k) {
    noise(e, out, t, { dur: 0.07, vol: 0.12 + 0.25 * k, filter: 'bandpass', freq: 2400, freqEnd: 700, q: 0.8 });
    tone(e, out, t, { freq: 180, freqEnd: 60, type: 'triangle', dur: 0.06, vol: 0.08 + 0.12 * k });
  },
  kill(e, out, t, k) {
    noise(e, out, t, { dur: 0.12, vol: 0.18 + 0.2 * k, filter: 'lowpass', freq: 900, freqEnd: 200 });
    tone(e, out, t, { freq: 140 + Math.random() * 40, freqEnd: 50, type: 'sine', dur: 0.12, vol: 0.3 * (0.5 + k) });
  },
  gateHit(e, out, t, _k, pitch) {
    tone(e, out, t, { freq: midiToHz(72 + pitch), type: 'triangle', dur: 0.06, vol: 0.22 });
  },
  gateGood(e, out, t) {
    [72, 76, 79, 84].forEach((m, i) =>
      tone(e, out, t + i * 0.06, { freq: midiToHz(m), type: 'square', dur: 0.18, vol: 0.12 }));
    tone(e, out, t, { freq: midiToHz(60), type: 'triangle', dur: 0.35, vol: 0.18 });
  },
  gateBad(e, out, t) {
    tone(e, out, t, { freq: 330, freqEnd: 110, type: 'sawtooth', dur: 0.4, vol: 0.14 });
    tone(e, out, t + 0.05, { freq: 311, freqEnd: 100, type: 'square', dur: 0.4, vol: 0.08 });
  },
  barrelHit(e, out, t, k) {
    tone(e, out, t, { freq: 220 + Math.random() * 30, freqEnd: 120, type: 'triangle', dur: 0.06, vol: 0.12 + 0.12 * k });
    noise(e, out, t, { dur: 0.04, vol: 0.08, filter: 'bandpass', freq: 1500, q: 3 });
  },
  barrelBreak(e, out, t) {
    noise(e, out, t, { dur: 0.45, vol: 0.5, filter: 'lowpass', freq: 2500, freqEnd: 150 });
    tone(e, out, t, { freq: 90, freqEnd: 40, type: 'sine', dur: 0.35, vol: 0.5 });
    [67, 71, 74, 79].forEach((m, i) =>
      tone(e, out, t + 0.12 + i * 0.05, { freq: midiToHz(m), type: 'square', dur: 0.15, vol: 0.09 }));
  },
  soldierLost(e, out, t, k) {
    tone(e, out, t, { freq: 260, freqEnd: 90, type: 'square', dur: 0.1, vol: 0.06 + 0.1 * k });
    noise(e, out, t, { dur: 0.08, vol: 0.1 + 0.1 * k, filter: 'lowpass', freq: 600 });
  },
  bossSpawn(e, out, t) {
    tone(e, out, t, { freq: 55, freqEnd: 110, type: 'sawtooth', dur: 1.2, vol: 0.35, attack: 0.15 });
    tone(e, out, t, { freq: 58, freqEnd: 116, type: 'sawtooth', dur: 1.2, vol: 0.25, attack: 0.15 });
    noise(e, out, t, { dur: 1.0, vol: 0.25, filter: 'lowpass', freq: 400, freqEnd: 1200, attack: 0.2 });
  },
  bossHit(e, out, t) {
    tone(e, out, t, { freq: 110, freqEnd: 70, type: 'square', dur: 0.06, vol: 0.18 });
    noise(e, out, t, { dur: 0.05, vol: 0.12, filter: 'bandpass', freq: 900, q: 2 });
  },
  bossDeath(e, out, t) {
    for (let i = 0; i < 4; i++) {
      noise(e, out, t + i * 0.18, { dur: 0.6, vol: 0.55, filter: 'lowpass', freq: 1800, freqEnd: 100 });
      tone(e, out, t + i * 0.18, { freq: 80, freqEnd: 30, type: 'sine', dur: 0.5, vol: 0.5 });
    }
  },
  win(e, out, t) {
    const notes = [67, 72, 76, 79, 76, 79, 84];
    const times = [0, 0.12, 0.24, 0.36, 0.54, 0.66, 0.8];
    notes.forEach((m, i) => {
      tone(e, out, t + times[i], { freq: midiToHz(m), type: 'square', dur: 0.22, vol: 0.13 });
      tone(e, out, t + times[i], { freq: midiToHz(m - 12), type: 'triangle', dur: 0.25, vol: 0.12 });
    });
  },
  lose(e, out, t) {
    [64, 63, 62, 61].forEach((m, i) =>
      tone(e, out, t + i * 0.28, { freq: midiToHz(m), type: 'sawtooth', dur: i === 3 ? 0.9 : 0.3, vol: 0.12 }));
    tone(e, out, t + 0.84, { freq: midiToHz(37), type: 'triangle', dur: 1.0, vol: 0.25 });
  },
  perk(e, out, t) {
    // Bright rising sparkle: a power-up.
    [76, 79, 83, 88, 91].forEach((m, i) =>
      tone(e, out, t + i * 0.045, { freq: midiToHz(m), type: 'triangle', dur: 0.25, vol: 0.16 }));
    tone(e, out, t, { freq: midiToHz(64), freqEnd: midiToHz(76), type: 'square', dur: 0.3, vol: 0.08 });
  },
  click(e, out, t) {
    tone(e, out, t, { freq: 880, freqEnd: 1320, type: 'square', dur: 0.06, vol: 0.2 });
  },
};

/** Minimum seconds between two plays of the same sound. */
const COOLDOWN: Partial<Record<SfxName, number>> = {
  shot: 0.055, kill: 0.045, gateHit: 0.06, barrelHit: 0.07, soldierLost: 0.07, bossHit: 0.09,
};

export class Sfx {
  private last = new Map<SfxName, number>();

  constructor(private eng: AudioEngine) {}

  play(name: SfxName, intensity = 1, pitch = 0): void {
    const ctx = this.eng.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const cd = COOLDOWN[name] ?? 0;
    if (cd > 0 && now - (this.last.get(name) ?? -1) < cd) return;
    this.last.set(name, now);
    SFX[name](this.eng, this.eng.sfx, now + 0.005, Math.max(0, Math.min(1, intensity)), pitch);
  }
}
