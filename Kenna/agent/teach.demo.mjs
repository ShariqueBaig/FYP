// Plays the human for the teaching feature, so it can be tested and re-recorded
// without anyone at the keyboard: real mouse and keyboard events (isTrusted), one
// demonstration per task, saved into agent/routines/ exactly as `fyp.mjs teach` would.
//
//   node agent/teach.demo.mjs like      -> routines/like.first.json
//   node agent/teach.demo.mjs comment   -> routines/comment.first.json
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const which = process.argv[2];
const DEMOS = {
  like: {
    name: 'like.first', phrases: ['like the first post', 'like the top post'],
    async perform(page) { await page.waitForTimeout(500); await page.locator('[data-testid^="like-"]').first().click(); await page.waitForTimeout(800); },
  },
  comment: {
    name: 'comment.first', phrases: ['comment {comment} on the first post'],
    async perform(page) {
      // A person looks at the screen between actions, so pause as one would.
      const look = () => page.waitForTimeout(700);
      await look();
      await page.getByText('Add a comment...', { exact: true }).first().click();      // open the comments
      await look();
      await page.locator('[data-testid="comment-input"]').click();
      await look();
      await page.keyboard.type('great shot', { delay: 40 });                          // a real person typing
      await look();
      await page.locator('[data-testid="comment-post"]').click();
      await look();
    },
  },
};
if (!DEMOS[which]) { console.error('usage: node agent/teach.demo.mjs like|comment'); process.exit(2); }

const { chromium } = await import('playwright');
const served = await startServer(0);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
// A wide window: the harness panel docks beside the 500px app column instead of
// covering it, as it would for a person teaching in a real window. Positions are
// stored relative to the app column, so the routine still replays at phone width.
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await page.goto(served.url + '/?demo=1&nc=' + Date.now(), { waitUntil: 'load' });
await page.evaluate(() => window.__FYP_AGENT.ready(30000));

const d = DEMOS[which];
const call = (fn, ...a) => page.evaluate(([f, x]) => { const p = f.split('.'); return p.slice(0, -1).reduce((o, k) => o[k], window.__FYP_AGENT)[p[p.length - 1]](...x); }, [fn, a]);
await call('teach.start', d.name);
await d.perform(page);
const res = await call('teach.stop');
await browser.close(); served.server.close();

if (!res.ok) { console.log(JSON.stringify(res, null, 2)); process.exit(1); }
res.routine.phrases = d.phrases;
const dir = path.join(HERE, 'routines');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, d.name + '.json'), JSON.stringify(res.routine, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, saved: 'agent/routines/' + d.name + '.json', readback: res.readback, params: res.routine.params, warnings: res.warnings }, null, 2));
