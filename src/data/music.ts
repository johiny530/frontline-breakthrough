// Background music as step-sequencer data (16 steps per bar, 16th notes).
// Patterns: 'x' = hit. Bass: 'r' root, 'f' fifth, 'o' octave, '.' rest.
// Lead: a digit picks a chord tone (wrapping up an octave past the last tone).

export interface TrackDef {
  bpm: number;
  chords: number[][]; // one chord per bar, MIDI notes, root first
  kick: string;
  snare: string;
  hat: string;
  bass: string;
  lead: string;
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  leadVol: number;
}

const Am = [57, 60, 64];
const F = [53, 57, 60];
const C = [48, 52, 55];
const G = [55, 59, 62];
const Dm = [50, 53, 57];
const E = [52, 56, 59];
const Bb = [58, 62, 65];

export const TRACKS = {
  // Calm march for the stage-select screen.
  menu: {
    bpm: 96,
    chords: [Am, F, C, G],
    kick: 'x.......x.......',
    snare: '............x...',
    hat: '..x...x...x...x.',
    bass: 'r.......f...r...',
    lead: '0...1...2...1...',
    bassWave: 'triangle',
    leadWave: 'triangle',
    leadVol: 0.07,
  },
  // Driving loop while running the track.
  stage: {
    bpm: 128,
    chords: [Am, Am, F, G, Am, Am, Dm, E],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.xx',
    bass: 'r.rr.r.rf.ff.f.o',
    lead: '0.2.3.2.0.2.4.3.',
    bassWave: 'sawtooth',
    leadWave: 'square',
    leadVol: 0.035,
  },
  // Faster, darker loop for the boss fight.
  boss: {
    bpm: 150,
    chords: [Am, Am, Bb, E],
    kick: 'x..x..x.x..x..x.',
    snare: '....x.......x..x',
    hat: 'xxxxxxxxxxxxxxxx',
    bass: 'rrrrrrrrrrrrorrf',
    lead: '4...3...2.1.0...',
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    leadVol: 0.04,
  },
} satisfies Record<string, TrackDef>;

export type TrackName = keyof typeof TRACKS;
