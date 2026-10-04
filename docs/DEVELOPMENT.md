# Frontline Breakthrough — Development notes

**▶ Play in the browser: https://johiny530.github.io/frontline-breakthrough/** (desktop or phone)

A 3D lane-runner shooter in the style of the *Last War: Survival* mini-game:
steer a squad left and right, shoot gates to raise their numbers, break barrels
to free soldiers, and push through zombie waves. Five campaign stages plus an
endless roguelike mode with perks and permanent upgrades.

Built with Vite + TypeScript + three.js. All sound is synthesized with Web Audio;
all models are Kenney CC0 assets (see `../CREDITS.md`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests for the game logic (vitest) |
| `npm run sim` | Bot plays the 5 campaign stages headless and prints results |
| `npm run sim:endless -- 10` | Bot plays 10 endless runs (`-- 10 max` = all permanent upgrades) |
| `npm run build` | Production build into `dist/` |
| `npm run build:artifact` | Single self-contained HTML in `dist-artifact/` (models inlined) |

Debug URL flags (dev server): `?stage=3` starts a stage directly, `?bot=1` lets the
autopilot steer, `?ts=4` speeds up time. In the console, `__fb` is the `Game`
instance: `__fb.advance(5)` simulates 5 seconds, `__fb.simulate()` runs the campaign bot.

## Layout

```
src/
  core/        Game (state machine, menus <-> stages), Stage (pure game state),
               Input, Storage (save data), Debug (bot, simulations)
    endless/   EndlessRun (one roguelike run), Generator (procedural sectors)
  entities/    Squad (ranked units), Enemy, Gate, Barrel, Bullets
  systems/     combat (firing, piercing bullets), enemies (movement),
               contacts (collisions, gates)
  render/      World (scene, camera, track), StageView (syncs state -> scene),
               CrowdRenderer (instanced animated crowds), TextSprite, Effects, Debris
  audio/       AudioEngine, synth, sfx, Music (step sequencer), GameAudio
  ui/          Hud, Screens (menus, results, perks, shop), icons
  data/        Tuning only: config, levels, endless, music
tests/         vitest unit tests (pure logic, no rendering)
scripts/       simulate*.ts (balance), build-artifact.mjs
```

The rule of thumb: **game rules never import three.js**. `Stage` and everything in
`entities/` and `systems/` run headless, which is what makes the bot simulations
and unit tests possible. Rendering reads the state and the per-frame `events` queue.

## Tuning

- Campaign stages: `src/data/levels.ts`
- Global numbers (speeds, ranks, fire rate, camera): `src/data/config.ts`
- Endless mode (perks, permanent upgrades, difficulty curve): `src/data/endless.ts`
- Music patterns: `src/data/music.ts`

After changing numbers, run `npm run sim` / `npm run sim:endless` to see the effect.
