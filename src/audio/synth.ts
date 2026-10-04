import type { AudioEngine } from './AudioEngine';

export interface ToneOpts {
  freq: number;
  freqEnd?: number; // exponential glide target
  type?: OscillatorType;
  dur: number;
  vol: number;
  attack?: number;
  detune?: number;
}

/** One oscillator note with an attack/exponential-decay envelope. */
export function tone(eng: AudioEngine, dest: AudioNode, t: number, o: ToneOpts): void {
  const ctx = eng.ctx!;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

export interface NoiseOpts {
  dur: number;
  vol: number;
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
}

/** Filtered white-noise burst (gunshots, drums, explosions). */
export function noise(eng: AudioEngine, dest: AudioNode, t: number, o: NoiseOpts): void {
  const ctx = eng.ctx!;
  const src = ctx.createBufferSource();
  src.buffer = eng.noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const a = o.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(dest);
  // Random offset so repeated bursts don't sound identical.
  src.start(t, Math.random() * 0.5, o.dur + 0.05);
}
