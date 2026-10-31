// node agent/voice.test.mjs - the in-page voice (fyp-mvp/voice.js): honest sentences, off unless asked, server wiring.
import { createRequire } from 'node:module';
import { startServer } from './server.mjs';
const { sentences } = createRequire(import.meta.url)('../fyp-mvp/voice.js');

let bad = 0;
const check = (name, ok, extra = '') => { console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : '  ' + extra)); if (!ok) bad++; };

check('passed step says done', sentences.step({ order: 2, intent: 'gallery.select', outcome: 'success' }, 'Choose a photo') === 'Step 2. Choose a photo. Done.');
check('failed step never says done', !/Done/.test(sentences.step({ order: 3, intent: 'x', outcome: 'failed-absent' }, 'Do x')));
check('flow completed -> task completed successfully', sentences.closing('Flow completed', '9 of 9 steps succeeded', [], {}) === 'Task completed successfully. 9 of 9 steps succeeded.');
const rows = [{ intent: 'a', outcome: 'success' }, { intent: 'share.post', outcome: 'failed-absent' }];
const stop = sentences.closing('Stopped honestly', 'A step could not be done', rows, { 'share.post': 'Publish the post' });
check('stopped honestly: names the step, never says success, offers the user the step', /could not finish/.test(stop) && /Publish the post/.test(stop) && /yourself/.test(stop) && !/successfully/.test(stop), stop);
const misses = sentences.closing('Finished with misses', '7 of 9 steps succeeded', rows, { 'share.post': 'Publish the post' });
check('misses are admitted, not called a success', /not everything worked/.test(misses) && !/successfully/.test(misses), misses);
check('ready / running banners say nothing', sentences.closing('Ready', '', [], {}) === '' && sentences.closing('Running', '', [], {}) === '');

const { server, url } = await startServer(0);
const get = async (p) => (await fetch(url + p)).text();
check('server: voice script is served', (await get('/fyp-voice.js')).includes('Voice feedback'));
check('server: normal page is untouched (no voice script)', !(await get('/?demo=1')).includes('fyp-voice.js'));
check('server: ?voice=1 adds the script', (await get('/?demo=1&voice=1')).includes('/fyp-voice.js'));
server.close();

console.log(bad ? '\n' + bad + ' FAILED' : '\nall voice checks passed');
process.exitCode = bad ? 1 : 0;
