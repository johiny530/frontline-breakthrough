import type { StageEvent } from '../core/Stage';
import { TRACKS, type TrackName } from '../data/music';
import { AudioEngine } from './AudioEngine';
import { Music } from './Music';
import { Sfx } from './sfx';

/** Maps game moments and stage events to music tracks and sound effects. */
export class GameAudio {
  readonly engine = new AudioEngine();
  private sfx = new Sfx(this.engine);
  private music = new Music(this.engine);

  get muted(): boolean {
    return this.engine.muted;
  }

  toggleMute(): boolean {
    this.engine.setMuted(!this.engine.muted);
    return this.engine.muted;
  }

  playTrack(name: TrackName | null): void {
    this.music.play(name ? TRACKS[name] : null);
  }

  setPaused(paused: boolean): void {
    this.engine.setMusicLevel(paused ? 0.35 : 1);
  }

  perk(): void {
    this.sfx.play('perk');
  }

  click(): void {
    this.sfx.play('click');
  }

  result(won: boolean): void {
    this.playTrack(null);
    this.sfx.play(won ? 'win' : 'lose');
  }

  handle(events: readonly StageEvent[]): void {
    let shots = 0;
    let kills = 0;
    let lost = 0;
    for (const ev of events) {
      switch (ev.type) {
        case 'shots': shots += ev.count; break;
        case 'kill': kills++; break;
        case 'soldiersLost': lost += ev.count; break;
        case 'gateHit': this.sfx.play('gateHit', 1, Math.max(0, Math.min(12, Math.floor(ev.gate.op === 'mul' ? (ev.gate.value - 0.5) * 8 : ev.gate.value / 3)))); break;
        case 'gatePass':
          if (ev.delta > 0) this.sfx.play('gateGood');
          else if (ev.delta < 0) this.sfx.play('gateBad');
          break;
        case 'barrelHit': this.sfx.play('barrelHit', 0.6); break;
        case 'barrelBreak': this.sfx.play('barrelBreak'); break;
        case 'bossSpawn':
          this.sfx.play('bossSpawn');
          this.playTrack('boss');
          break;
        case 'bossHit': this.sfx.play('bossHit'); break;
        case 'bossDeath': this.sfx.play('bossDeath'); break;
      }
    }
    // Bursty sounds play once per frame, louder when more happened.
    if (shots > 0) this.sfx.play('shot', shots / 8);
    if (kills > 0) this.sfx.play('kill', kills / 4);
    if (lost > 0) this.sfx.play('soldierLost', lost / 5);
  }
}
