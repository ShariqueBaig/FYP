// node agent/report.test.mjs  - no browser, no network. Exits 1 on any failure.
import { wilson, aggregate, renderMarkdown, csvOf } from './report.mjs';

let bad = 0;
const check = (name, ok, extra) => { if (!ok) { bad++; console.error('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const near = (a, b, tol = 0.002) => Math.abs(a - b) <= tol;

// Wilson 95% intervals against published reference values
let w = wilson(0, 2); check('wilson 0/2', near(w.lo, 0) && near(w.hi, 0.6576), w);
w = wilson(2, 2); check('wilson 2/2', near(w.lo, 0.3424) && near(w.hi, 1), w);
w = wilson(5, 10); check('wilson 5/10', near(w.lo, 0.2366) && near(w.hi, 0.7634), w);
w = wilson(9, 10); check('wilson 9/10', near(w.lo, 0.5958) && near(w.hi, 0.9821), w);
check('wilson n=0 is safe', wilson(0, 0).hi === 0);

// aggregate: one hybrid run that completes after a caught wrong tap, one llm-only run with a silent wrong action
const intents = [{ id: 'a' }, { id: 'b' }, { id: 'feed.assert' }];
const log = [
  { arm: 'hybrid', config: 'B1', run: 1, intent: 'a', outcome: 'success', failedActions: 1, semanticCalls: 1, ms: 10 },
  { arm: 'hybrid', config: 'B1', run: 1, intent: 'b', outcome: 'success', failedActions: 0, semanticCalls: 1, ms: 10 },
  { arm: 'hybrid', config: 'B1', run: 1, intent: 'feed.assert', outcome: 'success', ms: 1 },
  { arm: 'llm-only', config: 'B1', run: 2, intent: 'a', outcome: 'success', semanticCalls: 1, ms: 5 },
  { arm: 'llm-only', config: 'B1', run: 2, intent: 'b', outcome: 'failed-silent', failedActions: 1, semanticCalls: 1, injectedActs: 1, ms: 5 },
  { arm: 'baseline', config: 'B1', run: 3, intent: 'a', outcome: 'success', effectSeen: false, ms: 2 },
  { arm: 'baseline', config: 'B1', run: 3, intent: 'b', outcome: 'success', effectSeen: true, ms: 2 },
];
const rows = aggregate({ intents, log });
const by = Object.fromEntries(rows.map((r) => [r.arm, r]));
check('hybrid completed, 1 wrong action, 0 silent', by.hybrid.full === 1 && by.hybrid.wrong === 1 && by.hybrid.silent === 0, by.hybrid);
check('llm-only did not complete; the wrong action is silent; planted tap counted', by['llm-only'].full === 0 && by['llm-only'].silent === 1 && by['llm-only'].inj === 1, by['llm-only']);
check('baseline: a click with no effect counts as a silent wrong action even though it "succeeded"', by.baseline.silent === 1 && by.baseline.full === 1, by.baseline);
check('the assert step is not counted as an action', by.hybrid.steps === 2, by.hybrid);
const md = renderMarkdown(rows, { semantic: { provider: 'offline-lexical' }, valid: true }, 't');
check('stub results carry a loud warning', /STUB, not a language model/.test(md));
const md2 = renderMarkdown(rows, { semantic: { provider: 'openrouter:x' }, valid: false, invalidReason: '3 model call(s) failed' }, 't');
check('an invalid run says so in the table header', /\*\*NO\*\*/.test(md2) && !/STUB/.test(md2), md2.slice(0, 400));
check('csv has one line per config x arm plus a header', csvOf(rows).trim().split('\n').length === 4);

console.log(bad ? bad + ' failed' : 'all report checks passed');
if (bad) process.exitCode = 1;
