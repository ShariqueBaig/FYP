#!/usr/bin/env node
// Headless command line for the FYP self-healing harness. Built for an AI
// assistant (Momo) working from a plain shell:
//
//   * stdout is ONE JSON document, nothing else; progress goes to stderr
//   * exit code 0 = task completed, 1 = ran but needs the user, 2 = could not run
//   * a failure always carries `userMessage`: say it to the user, do not paraphrase
//     it away and do not retry blindly
//
// Commands: describe | status | run | intent <id> | survey | experiment
// See AGENTS.md for the full contract.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true; else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const log = (...a) => console.error('[fyp]', ...a);
const emit = (obj, code) => { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); process.exit(code); };

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (!cmd || args.help) {
  emit({ usage: [
    'fyp.mjs describe',
    'fyp.mjs status',
    'fyp.mjs run [--arm healed|baseline] [--breaks B1,B4] [--caption "text"] [--shot out.png]',
    'fyp.mjs intent <intent.id> [--caption "text"]',
    'fyp.mjs survey',
    'fyp.mjs experiment [--n 3] [--set demo|full] [--out dir]',
    'common: [--viewport 410x779] [--headed] [--url http://host:port]',
  ] }, cmd ? 0 : 2);
}

let playwright;
try { playwright = await import('playwright'); } catch (e) {
  emit({ ok: false, error: 'playwright-missing', userMessage: 'Run "bash agent/setup.sh" first (installs Playwright + Chromium).' }, 2);
}

const [vw, vh] = String(args.viewport || '410x779').split('x').map(Number);
let served = null;
let base = args.url;
if (!base) { served = await startServer(0); base = served.url; }

let browser;
try {
  browser = await playwright.chromium.launch({ headless: !args.headed, args: ['--no-sandbox'] });
} catch (e) {
  if (served) served.server.close();
  emit({ ok: false, error: 'browser-missing', userMessage: 'Chromium could not start. Run "bash agent/setup.sh" (add --with-deps on bare Linux). Detail: ' + String(e.message).split('\n')[0] }, 2);
}
const page = await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage();
page.on('pageerror', (e) => log('pageerror:', e.message));

async function finish(result, code) {
  await browser.close().catch(() => {});
  if (served) served.server.close();
  emit(result, code);
}

try {
  await page.goto(base + '/?demo=1&nc=' + Date.now(), { waitUntil: 'load' });
  const ready = await page.evaluate(() => (window.__FYP_AGENT ? window.__FYP_AGENT.ready(30000) : false));
  if (!ready) await finish({ ok: false, error: 'not-ready', userMessage: 'The app or harness did not finish loading. Check that demo/ is a current build.' }, 2);

  const call = (fn, ...a) => page.evaluate(([f, x]) => window.__FYP_AGENT[f](...x), [fn, a]);

  if (cmd === 'describe') await finish(await call('describe'), 0);
  if (cmd === 'status') await finish(await call('status'), 0);

  if (cmd === 'run') {
    const opts = {
      arm: args.arm === 'baseline' ? 'baseline' : 'healed',
      breaks: typeof args.breaks === 'string' ? args.breaks.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [],
      caption: typeof args.caption === 'string' ? args.caption : undefined,
    };
    log('run', JSON.stringify(opts));
    const res = await call('runFlow', opts);
    if (typeof args.shot === 'string') {
      await page.screenshot({ path: args.shot });
      res.screenshotFile = path.resolve(args.shot);
    }
    await finish(res, res.ok ? 0 : res.error ? 2 : 1);
  }

  if (cmd === 'intent') {
    if (!args._[1]) await finish({ ok: false, error: 'usage', userMessage: 'intent needs an id, e.g. post.open' }, 2);
    const res = await call('runIntent', args._[1], typeof args.caption === 'string' ? { caption: args.caption } : {});
    await finish(res, res.ok ? 0 : res.error ? 2 : 1);
  }

  if (cmd === 'survey') await finish({ ok: true, screens: await call('survey') }, 0);

  if (cmd === 'experiment') {
    const n = Number(args.n) || 3;
    log('experiment n=' + n + ' set=' + (args.set || 'demo') + ' (takes a while)');
    const res = await call('experiment', n, typeof args.set === 'string' ? args.set : 'demo');
    if (typeof args.out === 'string') {
      fs.mkdirSync(args.out, { recursive: true });
      fs.writeFileSync(path.join(args.out, 'results.json'), JSON.stringify(res, null, 2));
      for (const [name, fn] of [['summary.csv', 'summaryCsv'], ['attempt-log.csv', 'logCsv']]) {
        const csv = await page.evaluate((f) => window.__FYP_HARNESS[f](), fn);
        fs.writeFileSync(path.join(args.out, name), csv);
      }
      res.savedTo = path.resolve(args.out);
    }
    await finish({ ok: true, summary: res.summary, savedTo: res.savedTo || null }, 0);
  }

  await finish({ ok: false, error: 'unknown-command', userMessage: 'Unknown command: ' + cmd }, 2);
} catch (e) {
  await finish({ ok: false, error: 'exception', userMessage: 'Runner error: ' + (e && e.message) }, 2);
}
