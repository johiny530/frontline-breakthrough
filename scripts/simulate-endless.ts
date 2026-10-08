// Endless-mode balance check: `npm run sim:endless -- [runs] [max] [smart] [idle]`
//   max=N = every permanent upgrade at level N (plain `max` = 10), smart = picks the strongest perks, idle = never steers.
import { META_UPGRADES } from '../src/data/endless';
import { simulateEndless } from '../src/core/Debug';

const runs = Number(process.argv[2]) || 5;
const flags = new Set(process.argv.slice(3));
const maxFlag = [...flags].find((f) => f.startsWith('max'));
const level = maxFlag ? Number(maxFlag.split('=')[1] ?? 10) : 0;
const meta = Object.fromEntries(META_UPGRADES.map((u) => [u.id, level]));
console.log(`(every permanent upgrade at level ${level})`);
console.log(`perks: ${flags.has('smart') ? 'smart' : 'random'}, steering: ${flags.has('idle') ? 'none' : 'bot'}`);
console.log(simulateEndless(runs, meta, 30, { picks: flags.has('smart') ? 'smart' : 'random', steer: !flags.has('idle') }));
