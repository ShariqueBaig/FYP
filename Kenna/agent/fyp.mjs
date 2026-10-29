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
import { spawnSync } from 'node:child_process';
import { startServer } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Routines the user taught: one JSON file each. No secrets in them (a password
// field is never recorded), so they are meant to be committed and shared.
const ROUTINES = path.join(HERE, 'routines');
const loadRoutines = () => {
  if (!fs.existsSync(ROUTINES)) return [];
  return fs.readdirSync(ROUTINES).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try { return [JSON.parse(fs.readFileSync(path.join(ROUTINES, f), 'utf8'))]; } catch { return []; }
  });
};

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

// Anything that came out of the vault is scrubbed from the one JSON document, so
// a login can never leak through a message, a log row or an error string.
const secrets = new Set();
const scrub = (text) => {
  let t = text;
  for (const s of secrets) {
    if (!s) continue;
    for (const form of [s, JSON.stringify(s).slice(1, -1), encodeURIComponent(s)]) t = t.split(form).join('***');
  }
  return t;
};
// `decorate` lets `say` wrap the one result with what was heard and a sentence to
// read aloud; `--speak` then says it out loud (Windows speech, no extra install).
let decorate = null;
const speak = (text) => {
  if (!text || process.platform !== 'win32') return;
  spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak($env:FYP_SAY)'],
  { env: { ...process.env, FYP_SAY: text }, stdio: 'ignore' });
};
let speakIt = false;
const emit = (obj, code) => {
  if (decorate) obj = decorate(obj);
  process.stdout.write(scrub(JSON.stringify(obj, null, 2)) + '\n');
  if (speakIt && obj && obj.spoken) speak(scrub(obj.spoken));
  process.exit(code);
};

const args = parseArgs(process.argv.slice(2));
let cmd = args._[0];
if (!cmd || args.help) {
  emit({ usage: [
    'fyp.mjs describe',
    'fyp.mjs status',
    'fyp.mjs run [--arm healed|baseline] [--breaks B1,B4] [--caption "text"] [--shot out.png]',
    'fyp.mjs intent <intent.id> [--caption "text"]',
    'fyp.mjs survey',
    'fyp.mjs experiment [--n 3] [--set demo|full|semantic|inject|vision] [--arms baseline,healed,llm-only,model-verified,hybrid] [--semantic offline|anthropic] [--out dir]',
    'fyp.mjs say "post a photo with caption hello" [--speak]   plain English in; one JSON out (+ a sentence to read aloud)',
    'fyp.mjs teach --name like.first --say "like the first post" --headed   do a task ONCE by hand; Enter to finish; it learns the steps + a check for each',
    'fyp.mjs routines                   what has been taught',
    'fyp.mjs suggest <routine> --semantic offline|anthropic   model picks which recorded changes show the goal (stored as a suggestion; replay with routine <name> --use-suggested)',
    'fyp.mjs routine <name> [--params \'{"comment":"hi"}\'] [--breaks B1] [--arm healed|baseline] [--memory]',
    'fyp.mjs learn [--runs 8] [--drift-at 3] [--breaks B1,B6] [--out dir]   does remembering routes pay off after the UI changes?',
    'fyp.mjs run ... --memory           healed arm that remembers which route worked / failed',
    'fyp.mjs protect --url <site> --setting "<label>" [--n 10] [--gap 3] [--out dir]   how does the site\'s protection treat this agent? (measures, never evades)',
    'fyp.mjs login                      sign in to the live app with the vault login',
    'fyp.mjs vault status|set|clear     where the live login is kept (never printed)',
    'model:  [--semantic offline|anthropic] (key: env ANTHROPIC_API_KEY, else ANTHROPIC_API_KEY_FILE, else agent/anthropic.key) [--semantic-model id] [--semantic-cache file] [--semantic-shot (screenshot with numbered badges; needs a vision model)]   a model the harness asks only when every rule fails (anthropic needs ANTHROPIC_API_KEY in the env)',
    'common: [--viewport 410x779] [--headed] [--url http://host:port]',
    'live:   [--live] [--login]   --live opens the app WITHOUT demo mode; --login signs in from the vault',
    'gated site: set FYP_CF_ACCESS_ID + FYP_CF_ACCESS_SECRET (Cloudflare Access service token)',
  ] }, cmd ? 0 : 2);
}

if (cmd === 'vault') {
  const v = await import('./vault.mjs');
  const sub = args._[1] || 'status';
  if (sub === 'status') emit({ ok: true, ...v.status() }, 0);
  if (sub === 'set') { const r = v.setLogin(); emit(r, r.ok ? 0 : 2); }
  if (sub === 'clear') emit(v.clearLogin(), 0);
  emit({ ok: false, error: 'usage', userMessage: 'vault takes status, set or clear.' }, 2);
}

if (cmd === 'routines') {
  emit({ ok: true, routines: loadRoutines().map((r) => ({ name: r.name, steps: r.steps.length, phrases: r.phrases || [], params: Object.keys(r.params || {}), start: r.start && r.start.screen })) }, 0);
}

// say "<what the user asked>": map one sentence to a tool call, or say honestly
// why not. Nothing is run unless the sentence maps exactly (see nl.mjs).
if (cmd === 'say') {
  const { understand, spokenSummary } = await import('./nl.mjs');
  speakIt = !!args.speak;
  const utterance = args._.slice(1).join(' ');
  const u = understand(utterance, loadRoutines());
  if (u.kind === 'ask') emit({ ok: false, needsUser: true, error: 'need-more', heard: u.heard, question: u.question, userMessage: u.question, spoken: u.question }, 1);
  if (u.kind !== 'tool') emit({ ok: false, needsUser: true, error: 'not-understood', heard: u.heard || utterance, userMessage: u.userMessage, spoken: u.userMessage }, 1);
  const tool = u.tool;
  decorate = (res) => ({ heard: u.heard, understoodAs: { tool, params: u.params }, ...res, spoken: spokenSummary(tool, res) });
  if (tool === 'routine') { cmd = 'routine'; args._ = ['routine', u.params.name]; args.params = JSON.stringify(u.params.values); }
  else if (tool === 'create_post') { cmd = 'run'; args.caption = u.params.caption; }
  else cmd = { accessibility_survey: 'survey', status: 'status', describe: 'describe' }[tool];
}

// Live mode: the real app, with its login screen, instead of the offline demo.
const live = !!(args.live || args.login || cmd === 'login');
let login = null;
if (args.login || cmd === 'login') {
  const { getLogin } = await import('./vault.mjs');
  login = getLogin();
  if (!login) emit({ ok: false, needsUser: true, error: 'no-login-stored', userMessage: 'No login is stored. Run "node agent/fyp.mjs vault set" in your own terminal (or set FYP_LOGIN_EMAIL and FYP_LOGIN_PASSWORD), then try again.' }, 1);
  secrets.add(login.email); secrets.add(login.password);
}
const accessHeaders = (process.env.FYP_CF_ACCESS_ID && process.env.FYP_CF_ACCESS_SECRET)
  ? { 'CF-Access-Client-Id': process.env.FYP_CF_ACCESS_ID, 'CF-Access-Client-Secret': process.env.FYP_CF_ACCESS_SECRET } : null;
if (accessHeaders) secrets.add(process.env.FYP_CF_ACCESS_SECRET);

let playwright;
try { playwright = await import('playwright'); } catch (e) {
  emit({ ok: false, error: 'playwright-missing', userMessage: 'Run "bash agent/setup.sh" first (installs Playwright + Chromium).' }, 2);
}

const [vw, vh] = String(args.viewport || '410x779').split('x').map(Number);

// protect: N fresh paced trials against a hosted site, each sorted into what its
// protection layer did. Measures and reports only (see protect.mjs).
if (cmd === 'protect') {
  if (typeof args.url !== 'string') emit({ ok: false, error: 'usage', userMessage: 'protect needs --url <https://your-site> and a label, e.g. --setting "bot fight mode"' }, 2);
  const { runProtect } = await import('./protect.mjs');
  const res = await runProtect({
    playwright, base: args.url.replace(/\/$/, ''), n: Math.max(1, Math.min(100, Number(args.n) || 5)),
    setting: typeof args.setting === 'string' ? args.setting : 'unlabelled',
    gapMs: Math.max(0, Number(args.gap) >= 0 && args.gap !== undefined ? Number(args.gap) * 1000 : 3000),
    viewport: { width: vw, height: vh }, headers: accessHeaders, out: typeof args.out === 'string' ? args.out : null,
    headed: !!args.headed, log,
  });
  emit(res, 0);
}

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
const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, ...(accessHeaders ? { extraHTTPHeaders: accessHeaders } : {}) })).newPage();
page.on('pageerror', (e) => log('pageerror:', e.message));

// The semantic rung: a model the harness may ask when the rules cannot find a control.
// Off unless --semantic offline|anthropic is given (see semantic.mjs).
const { bridgeFromFlags } = await import('./semantic.mjs');
const sem = bridgeFromFlags({
  semantic: typeof args.semantic === 'string' ? args.semantic : null,
  model: typeof args['semantic-model'] === 'string' ? args['semantic-model'] : null,
  cache: typeof args['semantic-cache'] === 'string' ? args['semantic-cache'] : null,
  logFile: typeof args['semantic-log'] === 'string' ? args['semantic-log'] : null,
  screenshot: args['semantic-shot'] ? async () => (await page.screenshot({ type: 'png' })).toString('base64') : null,
  log,
});
if (!sem.ok) { await browser.close().catch(() => {}); if (served) served.server.close(); emit(sem, 2); }
if (sem.secret) secrets.add(sem.secret);
if (sem.bridge) await page.exposeFunction('__fypSemantic', sem.bridge);
// A model arm that hit provider errors (rate limit, bad key, outage) quietly lost its model: say so, loudly.
const validity = () => (sem.bridge && sem.bridge.stats.errors > 0
  ? { valid: false, invalidReason: sem.bridge.stats.errors + ' model call(s) failed (' + sem.bridge.stats.lastError + '): the model arms ran without their model on those steps. Re-run the same command; the disk cache keeps every answer already paid for, so only the gaps are retried.' }
  : { valid: true });
const semanticStats = async () => (sem.bridge ? { ...(await page.evaluate(() => window.__FYP_AGENT.semantic.stats())), bridge: sem.bridge.stats } : null);

// A rate limit shows up as refused sub-requests (HTTP 429), not as a broken page.
// Name it, so the user is not told to "check the build" when the site is throttling.
let throttled = 0;
page.on('response', (r) => { if (r.status() === 429) throttled++; });
const notReady = (msg) => throttled
  ? { ok: false, needsUser: true, error: 'rate-limited', suppression: { kind: 'rate-limit', status: 429, refused: throttled },
      userMessage: 'The site is limiting how fast I can load it (HTTP 429, ' + throttled + ' requests refused), so the app did not finish loading. I will not try to get around that. Wait a little and ask again, or ask the site owner to allow this assistant.' }
  : { ok: false, error: 'not-ready', userMessage: msg };

async function finish(result, code) {
  await browser.close().catch(() => {});
  if (served) served.server.close();
  emit(result, code);
}

try {
  // `fn` may be nested, e.g. "memory.clear"
  const call = (fn, ...a) => page.evaluate(([f, x]) => {
    const parts = f.split('.');
    const owner = parts.slice(0, -1).reduce((o, k) => o[k], window.__FYP_AGENT);
    return owner[parts[parts.length - 1]](...x);
  }, [fn, a]);

  const nav = await page.goto(base + (live ? '/?nc=' : '/?demo=1&nc=') + Date.now(), { waitUntil: 'load' });

  // Name a protective block as what it is. The runner reports it and stops: it
  // does not wait out, solve or route around a challenge (plan 2.4, hard rule 1).
  const hdr = nav ? nav.headers() : {};
  const title = await page.title().catch(() => '');
  const mitigated = hdr['cf-mitigated'] || null;                 // e.g. "challenge"
  const challengeTitle = /just a moment|attention required|verify you are human/i.test(title);
  if (mitigated || (nav && [403, 429, 503].includes(nav.status()) && challengeTitle)) {
    await finish({
      ok: false, needsUser: true, error: 'blocked-by-protection',
      suppression: { kind: mitigated || 'block-page', status: nav ? nav.status() : null, by: hdr.server || null, rayId: hdr['cf-ray'] || null },
      userMessage: 'The site is behind a protection check (' + (mitigated || 'block page') + ', HTTP ' + (nav ? nav.status() : '?') + ') and I was not let through. I will not try to get around it. You may need to open the page yourself, or ask the site owner to allow this assistant.',
    }, 1);
  }
  if (live) {
    // The login form comes first, so ready() (which needs the feed) cannot be asked yet.
    await page.waitForFunction(() => !!window.__FYP_AGENT, null, { timeout: 30000 }).catch(() => {});
    const alive = await page.evaluate(() => (window.__FYP_AGENT ? window.__FYP_AGENT.alive(30000) : null));
    if (!alive) await finish(notReady('The live app or harness did not finish loading. Check the URL and, if the site sits behind Cloudflare Access, the FYP_CF_ACCESS_* token.'), throttled ? 1 : 2);
    if (alive.loginScreen) {
      if (!login) await finish({ ok: false, needsUser: true, error: 'login-required', userMessage: 'The app is asking for a login. Run again with --login (store the login first with "fyp.mjs vault set").' }, 1);
      log('login screen up; signing in from the vault (' + login.source + ')');
      const res = await call('login', { email: login.email, password: login.password });
      if (!res.ok) await finish(res, 1);
      if (cmd === 'login') await finish({ ...res, status: await call('status') }, 0);
      await call('resetApp');           // lands on the feed and records the baseline
    } else if (cmd === 'login') {
      await finish({ ok: true, alreadySignedIn: true, status: await call('status') }, 0);
    }
  }
  const ready = await page.evaluate(() => (window.__FYP_AGENT ? window.__FYP_AGENT.ready(30000) : false));
  if (!ready) await finish(notReady(live ? 'Signed in, but the feed did not finish loading.' : 'The app or harness did not finish loading. Check that demo/ is a current build.'), throttled ? 1 : 2);

  if (sem.bridge) await call('semantic.configure', { enabled: true, marks: !!(args['semantic-shot'] || args['semantic-marks']) });
  if (cmd === 'describe') await finish(await call('describe'), 0);
  if (cmd === 'status') await finish(await call('status'), 0);

  if (cmd === 'run') {
    const opts = {
      arm: ['baseline', 'llm-only'].includes(args.arm) ? args.arm : 'healed',
      breaks: typeof args.breaks === 'string' ? args.breaks.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [],
      caption: typeof args.caption === 'string' ? args.caption : undefined,
      memory: !!args.memory,
    };
    if (opts.arm === 'llm-only' && !sem.bridge) await finish({ ok: false, error: 'usage', userMessage: '--arm llm-only needs a model: add --semantic offline or --semantic anthropic.' }, 2);
    log('run', JSON.stringify(opts));
    const res = await call('runFlow', opts);
    if (sem.bridge) { res.semantic = await semanticStats(); Object.assign(res, validity()); }
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
    const arms = typeof args.arms === 'string' ? args.arms.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    if (arms && arms.some((a) => ['llm-only', 'hybrid', 'model-verified'].includes(a)) && !sem.bridge) await finish({ ok: false, error: 'usage', userMessage: 'Arms llm-only, model-verified and hybrid need a model: add --semantic offline or --semantic anthropic.' }, 2);
    const res = await call('experiment', n, typeof args.set === 'string' ? args.set : 'demo', arms);
    res.semanticBridge = sem.bridge ? sem.bridge.stats : null;
    Object.assign(res, validity());
    if (res.valid === false) log('INVALID RUN: ' + res.invalidReason);
    if (typeof args.out === 'string') {
      fs.mkdirSync(args.out, { recursive: true });
      fs.writeFileSync(path.join(args.out, 'results.json'), JSON.stringify(res, null, 2));
      for (const [name, fn] of [['summary.csv', 'summaryCsv'], ['attempt-log.csv', 'logCsv']]) {
        const csv = await page.evaluate((f) => window.__FYP_HARNESS[f](), fn);
        fs.writeFileSync(path.join(args.out, name), csv);
      }
      res.savedTo = path.resolve(args.out);
    }
    if (typeof args.out === 'string') {
      fs.writeFileSync(path.join(args.out, 'results.json'), JSON.stringify(res, null, 2));
      const { buildManifest, aggregate, renderMarkdown, csvOf } = await import('./report.mjs');
      const v = validity();
      const manifest = buildManifest({
        command: 'fyp.mjs ' + process.argv.slice(2).join(' '), set: typeof args.set === 'string' ? args.set : 'demo',
        arms: arms || ['baseline', 'healed'], n, semantic: res.semantic || null, valid: v.valid, invalidReason: v.invalidReason,
        extra: { semanticBridge: res.semanticBridge || null, viewport: vw + 'x' + vh },
      });
      fs.writeFileSync(path.join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
      const rows = aggregate(res);
      fs.writeFileSync(path.join(args.out, 'report.md'), renderMarkdown(rows, manifest, path.basename(path.resolve(args.out))));
      fs.writeFileSync(path.join(args.out, 'report.csv'), csvOf(rows));
    }
    await finish({ ok: true, ...validity(), summary: res.summary, semantic: res.semantic || null, semanticBridge: res.semanticBridge, savedTo: res.savedTo || null }, 0);
  }

  // teach: the user does a task ONCE by hand in a real window; the harness turns it
  // into steps with a learned success check for each. Refuses what it cannot verify.
  if (cmd === 'teach') {
    if (typeof args.name !== 'string') await finish({ ok: false, error: 'usage', userMessage: 'teach needs --name <routine.name>, e.g. --name like.first --say "like the first post"' }, 2);
    if (!args.headed) await finish({ ok: false, error: 'usage', userMessage: 'Teaching needs a window you can use: add --headed.' }, 2);
    const started = await call('teach.start', args.name);
    if (!started.ok) await finish(started, 2);
    log('RECORDING "' + args.name + '". Do the task once in the browser window, then press Enter here.');
    await new Promise((resolve) => { process.stdin.resume(); process.stdin.once('data', resolve); });
    const res = await call('teach.stop');
    if (!res.ok) await finish(res, 1);
    if (typeof args.say === 'string') res.routine.phrases = [args.say];
    fs.mkdirSync(ROUTINES, { recursive: true });
    const file = path.join(ROUTINES, args.name.replace(/[^a-z0-9._-]+/gi, '_') + '.json');
    fs.writeFileSync(file, JSON.stringify(res.routine, null, 2) + '\n');
    await finish({ ok: true, saved: path.relative(process.cwd(), file), name: args.name, steps: res.routine.steps.length, readback: res.readback, params: res.routine.params, phrases: res.routine.phrases, warnings: res.warnings }, 0);
  }

  // suggest <routine>: ask the model which of the changes recorded after each step really show the goal.
  // Stored beside the original (step.suggested); replay uses it only with `routine <name> --use-suggested`.
  if (cmd === 'suggest') {
    if (!sem.bridge) await finish({ ok: false, error: 'usage', userMessage: 'suggest needs a model: add --semantic offline or --semantic anthropic.' }, 2);
    const name = args._[1];
    const routine = loadRoutines().find((r) => r.name === name);
    if (!routine) await finish({ ok: false, error: 'unknown-routine', userMessage: 'I have not been taught "' + name + '".' }, 2);
    const res = await call('teach.suggest', routine, (routine.phrases || [])[0]);
    if (!res.ok) await finish(res, 2);
    for (const r of res.steps) {
      const st = routine.steps.find((x) => x.n === r.n);
      if (r.suggested) st.suggested = r.suggested; else delete st.suggested;
    }
    const file = path.join(ROUTINES, name.replace(/[^a-z0-9._-]+/gi, '_') + '.json');
    fs.writeFileSync(file, JSON.stringify(routine, null, 2) + '\n');
    await finish({ ok: true, routine: name, saved: path.relative(process.cwd(), file), steps: res.steps, semanticBridge: sem.bridge.stats, note: 'Nothing is applied until you replay with: routine ' + name + ' --use-suggested' }, 0);
  }

  if (cmd === 'routine') {
    const name = args._[1];
    const routine = loadRoutines().find((r) => r.name === name);
    if (!routine) await finish({ ok: false, error: 'unknown-routine', userMessage: 'I have not been taught "' + name + '". Taught so far: ' + (loadRoutines().map((r) => r.name).join(', ') || 'nothing') + '.' }, 2);
    // Replay where it was taught: positions are the one thing that moves with window size.
    if (!args.viewport && routine.viewport && (routine.viewport.w !== vw || routine.viewport.h !== vh)) {
      log('resizing to the taught viewport ' + routine.viewport.w + 'x' + routine.viewport.h);
      await page.setViewportSize({ width: routine.viewport.w, height: routine.viewport.h });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__FYP_AGENT.ready(15000));
    }
    let params = {};
    try { if (typeof args.params === 'string') params = JSON.parse(args.params); } catch { await finish({ ok: false, error: 'usage', userMessage: '--params must be JSON, e.g. --params \'{"comment":"nice"}\'' }, 2); }
    if (typeof args.param === 'string' && args.param.includes('=')) { const [k, ...v] = args.param.split('='); params[k] = v.join('='); }
    const res = await call('runRoutine', {
      routine, params, memory: !!args.memory, useSuggested: !!args['use-suggested'],
      arm: args.arm === 'baseline' ? 'baseline' : 'healed',
      breaks: typeof args.breaks === 'string' ? args.breaks.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [],
    });
    await finish(res, res.ok ? 0 : res.error ? 2 : 1);
  }

  // Does remembering routes pay off when the UI changes? Same page, R runs back to
  // back; the first `--drift-at` runs are on the healthy app, then the breaks arrive.
  // Run once with memory on and once with it off and compare what each wasted.
  if (cmd === 'learn') {
    const runs = Math.max(2, Number(args.runs) || 8);
    const driftAt = Math.min(runs - 1, Math.max(1, Number(args['drift-at']) || 3));
    const breaks = (typeof args.breaks === 'string' ? args.breaks : 'B1,B6').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const arms = {};
    // plain / memory are the original pair; with a model, semantic and semantic+memory
    // show what asking a model costs and whether distilling its answer pays that back.
    const armNames = sem.bridge ? ['plain', 'memory', 'semantic', 'semantic+memory'] : ['memory', 'plain'];
    for (const arm of armNames) {
      await call('memory.clear');
      await call('semantic.reset');
      await call('semantic.configure', { enabled: arm.startsWith('semantic') });
      arms[arm] = { runs: [] };
      for (let r = 1; r <= runs; r++) {
        const armed = r > driftAt ? breaks : [];
        log('learn ' + arm + ' run ' + r + '/' + runs + (armed.length ? ' breaks=' + armed.join('+') : ' (healthy)'));
        const res = await call('runFlow', { breaks: armed, memory: arm === 'memory' || arm === 'semantic+memory' });
        const rows = res.rows || [];
        arms[arm].runs.push({
          run: r, breaks: armed, ok: !!res.ok, stepsOk: res.stepsOk,
          failedActions: rows.reduce((s, x) => s + (x.failedActions || 0), 0),
          semanticCalls: rows.reduce((s, x) => s + (x.semanticCalls || 0), 0),
          ms: rows.reduce((s, x) => s + (x.ms || 0), 0),
          routes: rows.map((x) => x.route),
        });
      }
      if (arm.endsWith('memory')) arms[arm].memory = await call('memory.summary');
    }
    await call('semantic.configure', { enabled: !!sem.bridge });
    const after = (a) => arms[a].runs.filter((x) => x.run > driftAt);
    const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
    // Runs to settle, per arm: from the run where the change first appeared (counted
    // as 1) to the first run in which no action was wasted. null = never, within `runs`.
    const settleOf = (a) => { const hit = after(a).find((x) => x.failedActions === 0); return hit ? hit.run - driftAt : null; };
    const out = {
      ok: true, ...validity(), driftAt, runs, breaks,
      summary: {
        afterDrift: Object.fromEntries(armNames.map((a) => [a, {
          meanFailedActions: mean(after(a).map((x) => x.failedActions)), meanMs: mean(after(a).map((x) => x.ms)),
          meanModelCalls: mean(after(a).map((x) => x.semanticCalls)), fullFlows: after(a).filter((x) => x.ok).length,
        }])),
        runsToSettle: Object.fromEntries(armNames.map((a) => [a, settleOf(a)])),
        modelCallsPerRun: Object.fromEntries(armNames.filter((a) => a.startsWith('semantic')).map((a) => [a, arms[a].runs.map((x) => x.semanticCalls)])),
        note: 'runsToSettle = runs from the one where the UI change first appeared (counted as 1) to the first run that wasted no action; null = did not settle within the runs given. A wasted action is a route that resolved to one control, was acted on and did not achieve the goal. B1 re-randomises hook names every run, so per-intent drift counts in arms.memory.memory are high by design.',
      },
      arms,
    };
    if (typeof args.out === 'string') {
      fs.mkdirSync(args.out, { recursive: true });
      fs.writeFileSync(path.join(args.out, 'learn.json'), JSON.stringify(out, null, 2));
      const lines = ['arm,run,breaks,ok,steps_ok,failed_actions,model_calls,ms'];
      for (const [arm, a] of Object.entries(arms)) for (const x of a.runs) lines.push([arm, x.run, x.breaks.join('+') || 'clean', x.ok, x.stepsOk, x.failedActions, x.semanticCalls, x.ms].join(','));
      fs.writeFileSync(path.join(args.out, 'learn.csv'), lines.join('\n') + '\n');
      out.savedTo = path.resolve(args.out);
    }
    await finish(out, 0);
  }

  await finish({ ok: false, error: 'unknown-command', userMessage: 'Unknown command: ' + cmd }, 2);
} catch (e) {
  await finish({ ok: false, error: 'exception', userMessage: 'Runner error: ' + (e && e.message) }, 2);
}
