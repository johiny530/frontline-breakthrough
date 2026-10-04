// Balance check without a browser: `npm run sim` (optionally `npm run sim -- 5` for 5 runs).
import { LEVELS } from '../src/data/levels';
import { simulateAll } from '../src/core/Debug';

const runs = Number(process.argv[2]) || 3;
for (let r = 1; r <= runs; r++) {
  console.log(`--- run ${r}`);
  console.log(simulateAll(LEVELS));
}
