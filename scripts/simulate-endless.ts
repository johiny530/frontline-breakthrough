// Endless-mode balance check: `npm run sim:endless` (optionally `-- 10 max` for 10 runs with maxed upgrades).
import { META_UPGRADES } from '../src/data/endless';
import { simulateEndless } from '../src/core/Debug';

const runs = Number(process.argv[2]) || 5;
const maxed = process.argv[3] === 'max';
const meta = maxed ? Object.fromEntries(META_UPGRADES.map((u) => [u.id, u.maxLevel])) : {};
console.log(maxed ? '(all permanent upgrades maxed)' : '(no permanent upgrades)');
console.log(simulateEndless(runs, meta));
