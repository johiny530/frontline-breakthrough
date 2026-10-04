// Endless-mode balance check: `npm run sim:endless -- [runs] [max] [smart] [idle]`
//   max   = all permanent upgrades, smart = picks the strongest perks, idle = never steers.
import { META_UPGRADES } from '../src/data/endless';
import { simulateEndless } from '../src/core/Debug';

const runs = Number(process.argv[2]) || 5;
const flags = new Set(process.argv.slice(3));
const maxed = flags.has('max');
const meta = maxed ? Object.fromEntries(META_UPGRADES.map((u) => [u.id, u.maxLevel])) : {};
console.log(maxed ? '(all permanent upgrades maxed)' : '(no permanent upgrades)');
console.log(`perks: ${flags.has('smart') ? 'smart' : 'random'}, steering: ${flags.has('idle') ? 'none' : 'bot'}`);
console.log(simulateEndless(runs, meta, 30, { picks: flags.has('smart') ? 'smart' : 'random', steer: !flags.has('idle') }));
