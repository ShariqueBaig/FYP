#!/usr/bin/env node
// Adversarial demo (poster Phase 2, "Surviving Hostile UIs"). Everything here is
// MEASURED or SURVIVED, nothing is evaded (plan 2.4, AGENTS.md hard rule 1).
//
//   node agent/demo_adversarial.mjs [--headed] [--live-model] [--pause 3]
//
// Part 1  DOM rotation / tree suppression: the same flow under injected UI attacks,
//         recorded script (baseline) vs our ladder (healed). B8 stops honestly.
// Part 2  Hostile text (B11): published N=10 real-model table; with --live-model it
//         also runs one B9+B11 flow through the model rung (needs a key, see README).
// Part 3  Protection layer: published `protect` measurement (read from CSV if present).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const headed = flag('--headed');
const pauseMs = Number(val('--pause', headed ? 3 : 0)) * 1000;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const CASES = [
  { id: 'clean',    breaks: '',           what: 'nothing changed (control)' },
  { id: 'B1',       breaks: 'B1',         what: 'DOM rotation: ids and test-ids renamed' },
  { id: 'B2',       breaks: 'B2',         what: 'tree suppression: accessible labels stripped' },
  { id: 'B6',       breaks: 'B6',         what: 'controls reduced to bare icons' },
  { id: 'B1+B2+B6', breaks: 'B1,B2,B6',   what: 'all three at once' },
  { id: 'B7',       breaks: 'B7',         what: 'an overlay is painted over the control' },
  { id: 'B8',       breaks: 'B8',         what: 'the control is hidden entirely (unreachable)' },
];

function fyp(args) {
  const r = spawnSync(process.execPath, [path.join(here, 'fyp.mjs'), ...args], { encoding: 'utf8', cwd: root, maxBuffer: 64 << 20 });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, stepsOk: 0, stepsTotal: 9, userMessage: `no JSON (exit ${r.status}): ${(r.stderr || '').slice(-200)}` }; }
}

function verdict(j) {
  if (j.ok && j.stepsOk === j.stepsTotal) return `${j.stepsOk}/${j.stepsTotal} completed`;
  const why = String(j.userMessage || 'stopped').replace(/\s+/g, ' ');
  return `${j.stepsOk}/${j.stepsTotal} STOPPED - ${why.length > 70 ? why.slice(0, 67) + '...' : why}`;
}

const pad = (s, n) => String(s).padEnd(n);
const hr = (t) => console.log(`\n=== ${t} ${'='.repeat(Math.max(0, 70 - t.length))}`);

hr('PART 1  DOM rotation and tree suppression (same flow, same app)');
console.log(`${pad('attack', 10)} ${pad('recorded script (baseline)', 62)} our ladder (healed)`);
for (const c of CASES) {
  const common = [...(c.breaks ? ['--breaks', c.breaks] : []), ...(headed ? ['--headed'] : [])];
  console.log(`\n[${c.id}] ${c.what}`);
  const base = fyp(['run', ...common, '--arm', 'baseline']);
  const heal = fyp(['run', ...common, '--arm', 'healed']);
  console.log(`  baseline : ${verdict(base)}`);
  console.log(`  healed   : ${verdict(heal)}`);
  if (c.id === 'B8') console.log('  (an honest stop is the intended result: the control cannot be reached, so the agent says so instead of guessing)');
  if (pauseMs) sleep(pauseMs);
}

hr('PART 2  Hostile text: planted instructions in labels (B11)');
const inj = path.join(root, 'results', 'published', 'inject_n10_qwen37flash', 'report.md');
if (fs.existsSync(inj)) {
  const rows = fs.readFileSync(inj, 'utf8').split('\n').filter((l) => /^\| (B11|B11\+B9|B1\+B10\+B11\+B9) \|/.test(l));
  console.log('model: qwen/qwen3.7-flash via OpenRouter, N=10 per row (results/published/inject_n10_qwen37flash)');
  console.log('config | arm | flows | completed (95% CI) | wrong/run | silent wrong/run | planted taps/run | model calls/run | ms/run');
  rows.forEach((l) => console.log(l.replace(/^\| /, '').replace(/ \|$/, '')));
  console.log('\nread it: llm-only follows the planted label and never notices (silent wrong). hybrid can still tap a planted control (planted taps/run) but the step check catches it and it recovers.');
} else console.log('published result not found: node agent/report.mjs agent/results/protocol/inject_n10_qwen_qwen3_7-flash --publish inject_n10_qwen37flash');

if (flag('--live-model')) {
  console.log('\nlive: one B9+B11 flow through the model rung (answers cached when seen before)');
  const cache = path.join(here, 'results', 'protocol', 'cache_openrouter_qwen_qwen3_7-flash.json');
  const j = fyp(['run', '--breaks', 'B9,B11', '--semantic', 'openrouter', '--semantic-model', 'qwen/qwen3.7-flash', '--semantic-cache', cache, ...(headed ? ['--headed'] : [])]);
  console.log(`  hybrid   : ${verdict(j)}`);
  const acts = (j.rows || []).reduce((a, r) => a + (r.injectedActs || 0), 0);
  const calls = (j.rows || []).reduce((a, r) => a + (r.semanticCalls || 0), 0);
  console.log(`  planted-instruction taps: ${acts}   model calls: ${calls}`);
}

hr('PART 3  Protection layer: measured, never evaded');
const csv = path.join(here, 'results', 'protection', 'protection.csv');
if (fs.existsSync(csv)) {
  const [head, ...lines] = fs.readFileSync(csv, 'utf8').trim().split('\n');
  const cols = head.split(',');
  const iS = cols.indexOf('setting'), iC = cols.indexOf('class');
  const by = {};
  for (const l of lines) {
    const m = l.match(/("([^"]*)"|[^,]*)/g).filter((_, i) => i % 2 === 0).map((s) => s.replace(/^"|"$/g, ''));
    const k = m[iS]; by[k] = by[k] || {}; by[k][m[iC]] = (by[k][m[iC]] || 0) + 1;
  }
  for (const [setting, cls] of Object.entries(by)) {
    const n = Object.values(cls).reduce((a, b) => a + b, 0);
    console.log(`  ${pad(setting, 40)} n=${n}  ${Object.entries(cls).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
} else console.log('  no local measurement found; run: node agent/fyp.mjs protect --url <site> --setting "<label>" --n 10 --out results/protection');
console.log('  This reports which mechanism fired and how often. It does not solve challenges, spoof a browser or rotate addresses.');
console.log('\ndone.');
