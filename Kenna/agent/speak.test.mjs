// node agent/speak.test.mjs - the sentences the assistant speaks, and that speaking never claims more than happened.
import { stepSentence, finalSentence, narrate, intentSentence, sayAloud } from './speak.mjs';

let bad = 0;
const check = (name, ok, extra = '') => { console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : '  ' + extra)); if (!ok) bad++; };
const descs = { 'post.open': 'Open the create-post flow', 'share.post': 'Publish the post' };

check('a passed step says done', stepSentence({ order: 1, intent: 'post.open', outcome: 'success' }, descs) === 'Step 1. Open the create-post flow. Done.');
check('a failed step never says done', !/Done/.test(stepSentence({ order: 8, intent: 'share.post', outcome: 'failed-absent' }, descs)) && /could not/.test(stepSentence({ order: 8, intent: 'share.post', outcome: 'failed-absent' }, descs)));
check('unknown intent falls back to its id', /mystery\.step/.test(stepSentence({ order: 2, intent: 'mystery.step', outcome: 'success' }, descs)));

const ok = { ok: true, stepsOk: 9, stepsTotal: 9, rows: [{ routeIndex: 1, route: 'label' }] };
check('full success: says completed successfully with the count', /completed successfully/.test(finalSentence(ok)) && /all 9 steps/.test(finalSentence(ok)));
check('fallbacks are admitted', /fallback on 1 of them/.test(finalSentence({ ...ok, rows: [{ routeIndex: 4, route: 'vision[0]' }] })));
const stop = { ok: false, stepsOk: 0, stepsTotal: 9, userMessage: 'I could not finish the step "Open the create-post flow". You may need to do this step yourself.' };
check('a stop is spoken honestly, with how far it got', /could not finish/.test(finalSentence(stop)) && /0 of 9/.test(finalSentence(stop)) && !/successfully/.test(finalSentence(stop)));
const tech = { ok: false, stepsOk: 0, stepsTotal: 9, userMessage: 'I could not finish the step "Open it" - I cannot identify a control for this step. You may need to do this step yourself. [every route was tried: id(0), label(0)]' };
check('the bracketed route list is never read aloud', !/id\(0\)|\[|\]/.test(finalSentence(tech)) && !/ - /.test(finalSentence(tech)), finalSentence(tech));
check('no duplicate "yourself" advice', (finalSentence(stop).match(/yourself/g) || []).length === 1);
check('a stop without a message still tells the user', /could not finish the task/.test(finalSentence({ ok: false, stepsOk: 3, stepsTotal: 9 })) && /yourself/.test(finalSentence({ ok: false, stepsOk: 3, stepsTotal: 9 })));
check('partial run (ok but fewer steps) is not called a success', !/successfully/.test(finalSentence({ ok: true, stepsOk: 5, stepsTotal: 9 })));
check('narrate without steps is just the closing line', narrate(ok) === finalSentence(ok));
check('narrate with steps reads every step then the close', narrate({ ...ok, rows: [{ order: 1, intent: 'post.open', outcome: 'success' }] }, { steps: true, descs }).startsWith('Step 1. Open the create-post flow. Done. Task completed'));
check('android intent: success', intentSentence({ goal: 'Open the battery settings', outcome: 'success' }) === 'Done. Open the battery settings.');
check('android intent: failure is honest', /could not do this: open the battery settings/.test(intentSentence({ goal: 'Open the battery settings', outcome: 'failed-absent' })) && /yourself/.test(intentSentence({ goal: 'x', outcome: 'failed-absent' })));

const calls = [];
check('windows: uses powershell speech with the text in the environment', sayAloud('hello  world', { platform: 'win32', run: (c, a, o) => { calls.push([c, o.env.FYP_SAY]); return {}; } }) && calls[0][0] === 'powershell.exe' && calls[0][1] === 'hello world');
check('macos: uses say', sayAloud('hi', { platform: 'darwin', run: (c) => { calls.push(c); return {}; } }) && calls.includes('say'));
check('linux with no engine: returns false, does not throw', sayAloud('hi', { platform: 'linux', run: () => ({ error: new Error('ENOENT') }) }) === false);
check('empty text is not spoken', sayAloud('   ', { platform: 'win32', run: () => { throw new Error('should not run'); } }) === false);

console.log(bad ? '\n' + bad + ' FAILED' : '\nall speak checks passed');
process.exit(bad ? 1 : 0);
