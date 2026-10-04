import type { TrackDef } from '../data/music';
import { midiToHz, type AudioEngine } from './AudioEngine';
import { noise, tone } from './synth';

const LOOKAHEAD = 0.12; // seconds of audio scheduled ahead of the clock
const TICK_MS = 25;

/** Look-ahead step sequencer that plays a TrackDef on a loop. */
export class Music {
  private track: TrackDef | null = null;
  private step = 0;
  private next = 0;
  private restart = false;

  constructor(private eng: AudioEngine) {
    window.setInterval(() => this.tick(), TICK_MS);
  }

  play(track: TrackDef | null): void {
    if (track === this.track) return;
    this.track = track;
    this.restart = true;
  }

  private tick(): void {
    const ctx = this.eng.ctx;
    const tr = this.track;
    if (!ctx || ctx.state !== 'running' || !tr) return;
    const now = ctx.currentTime;
    if (this.restart || this.next < now - 0.1) {
      this.restart = false;
      this.step = 0;
      this.next = now + 0.05;
    }
    const stepDur = 60 / tr.bpm / 4;
    while (this.next < now + LOOKAHEAD) {
      this.playStep(tr, this.step, this.next, stepDur);
      this.next += stepDur;
      this.step++;
    }
  }

  private playStep(tr: TrackDef, step: number, t: number, sd: number): void {
    const e = this.eng;
    const out = e.music;
    const s = step % 16;
    const chord = tr.chords[Math.floor(step / 16) % tr.chords.length];

    if (tr.kick[s] === 'x') tone(e, out, t, { freq: 150, freqEnd: 42, type: 'sine', dur: 0.22, vol: 0.9 });
    if (tr.snare[s] === 'x') {
      noise(e, out, t, { dur: 0.14, vol: 0.35, filter: 'bandpass', freq: 1900, q: 0.7 });
      tone(e, out, t, { freq: 190, freqEnd: 140, type: 'triangle', dur: 0.08, vol: 0.25 });
    }
    if (tr.hat[s] === 'x') noise(e, out, t, { dur: 0.035, vol: s % 4 === 0 ? 0.13 : 0.08, filter: 'highpass', freq: 7000 });

    const b = tr.bass[s];
    if (b !== '.') {
      const root = chord[0] - 24;
      const m = b === 'f' ? root + 7 : b === 'o' ? root + 12 : root;
      tone(e, out, t, { freq: midiToHz(m), type: tr.bassWave, dur: sd * 1.7, vol: tr.bassWave === 'sawtooth' ? 0.16 : 0.35 });
    }

    const l = tr.lead[s];
    if (l !== '.') {
      const i = Number(l);
      const m = chord[i % chord.length] + 12 * Math.floor(i / chord.length) + 12;
      tone(e, out, t, { freq: midiToHz(m), type: tr.leadWave, dur: sd * 1.6, vol: tr.leadVol });
    }
  }
}
