// bun run scripts/example-hybrid-advisor.ts
import { getHybridTimingAdviceSync, KARTIKAY_PROFILE } from '../src/lib/hybridTimingAdvisor';

const dt = new Date('2026-06-23T15:28:00+05:30');

const advice = await getHybridTimingAdviceSync({
  targetDateTime: dt,
  user: KARTIKAY_PROFILE,
});

console.log(JSON.stringify(advice, null, 2));