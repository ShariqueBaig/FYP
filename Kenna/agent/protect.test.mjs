// node agent/protect.test.mjs  - classifier + interval maths, no browser, no network.
import { classify, wilson } from './protect.mjs';
const cases = [
  [{ navStatus: 200, flowOk: true }, 'completed'],
  [{ navStatus: 403, hdr: { 'cf-mitigated': 'challenge' } }, 'challenged'],
  [{ navStatus: 200, finalUrl: 'https://x.cloudflareaccess.com/cdn-cgi/access/login' }, 'access-gated'],
  [{ navStatus: 429 }, 'rate-limited'],
  [{ navStatus: 200, flowOk: false, sub: { 429: 7 } }, 'rate-limited'],
  [{ navStatus: 403 }, 'blocked'],
  [{ navStatus: 502 }, 'http-error'],
  [{ navStatus: 200, flowOk: false }, 'incomplete'],
  [{ reached: false }, 'unreachable'],
];
let bad = 0;
for (const [input, want] of cases) { const got = classify(input); if (got !== want) { bad++; console.error('FAIL', JSON.stringify(input), got, 'want', want); } }
const [lo, hi] = wilson(10, 10);
if (!(lo > 0.7 && hi === 1)) { bad++; console.error('FAIL wilson(10,10)', lo, hi); }
console.log(bad ? bad + ' failed' : 'all ' + (cases.length + 1) + ' passed');
process.exit(bad ? 1 : 0);
