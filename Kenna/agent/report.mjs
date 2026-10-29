#!/usr/bin/env node
// Turn raw experiment output into the tables a defense needs, with every number traceable to a raw log.
//
//   node agent/report.mjs <resultsDir> [--publish <name>]
//
// <resultsDir> is what `fyp.mjs experiment --out <dir>` wrote (results.json, manifest.json, CSVs).
// Writes <resultsDir>/report.md and report.csv. With --publish <name> the raw files + report are also copied to
// Kenna/results/published/<name>/ (committed to git; agent/results is not), so the numbers in a thesis or slide can
// always be regenerated from files that are in the repo.
//
// A "flow" is one run of the whole create-post task by one arm under one break configuration. "Completed" means
// every action step succeeded (the same definition as the harness summary). Intervals are 95% Wilson score
// intervals on completed/total. Repetitions use temperature 0 and a disk cache, so they measure variation in the
// app and harness, NOT sampling variation of the model: say so when you quote them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

export function wilson(k, n, z = 1.96) {
  if (!n) return { p: 0, lo: 0, hi: 0 };
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

const pct = (x) => Math.round(x * 100);
const fmtCI = (k, n) => { const w = wilson(k, n); return n ? `${pct(w.p)}% [${pct(w.lo)}-${pct(w.hi)}]` : 'n/a'; };

/** Aggregate the raw attempt log into one row per (config, arm). */
export function aggregate(results) {
  const ACTION = new Set((results.intents || []).map((i) => i.id).filter((id) => id !== 'feed.assert'));
  const runs = new Map();
  for (const r of results.log || []) {
    const arm = r.arm || 'healed', config = r.config || 'clean';
    const key = `${config}|${arm}|${r.run}`;
    const e = runs.get(key) || { config, arm, ok: 0, actions: 0, wrong: 0, silent: 0, calls: 0, ms: 0, inj: 0, rows: 0 };
    e.rows++;
    e.ms += r.ms || 0; e.calls += r.semanticCalls || 0; e.inj += r.injectedActs || 0;
    if (r.outcome === 'failed-silent') { e.wrong++; e.silent++; }
    else if (arm === 'baseline') { if (r.outcome === 'success' && r.effectSeen === false) { e.wrong++; e.silent++; } }
    else e.wrong += r.failedActions || 0;
    if (r.outcome === 'success' && ACTION.has(r.intent)) e.actions++;
    runs.set(key, e);
  }
  const agg = new Map();
  for (const e of runs.values()) {
    const k = `${e.config}|${e.arm}`;
    const a = agg.get(k) || { config: e.config, arm: e.arm, n: 0, full: 0, wrong: 0, silent: 0, calls: 0, ms: 0, inj: 0, steps: 0 };
    a.n++; a.full += e.actions === ACTION.size ? 1 : 0; a.wrong += e.wrong; a.silent += e.silent; a.calls += e.calls; a.ms += e.ms; a.inj += e.inj; a.steps += e.actions;
    agg.set(k, a);
  }
  return [...agg.values()];
}

const ARM_ORDER = ['baseline', 'healed', 'llm-only', 'model-verified', 'hybrid'];
const sortRows = (rows) => rows.sort((a, b) => (a.config.length - b.config.length) || a.config.localeCompare(b.config) || ARM_ORDER.indexOf(a.arm) - ARM_ORDER.indexOf(b.arm));

export function renderMarkdown(rows, manifest, name) {
  const L = [];
  L.push(`# Results: ${name}`, '');
  if (manifest) {
    L.push('| field | value |', '|---|---|');
    const sem = manifest.semantic || {};
    for (const [k, v] of [
      ['date', manifest.date], ['git commit', `${manifest.git && manifest.git.commit}${manifest.git && manifest.git.dirty ? ' (+uncommitted changes)' : ''}`],
      ['harness sha256', manifest.harnessSha256 && manifest.harnessSha256.slice(0, 16)], ['command', manifest.command],
      ['config set / arms / N', `${manifest.set} / ${(manifest.arms || []).join(', ')} / ${manifest.n}`],
      ['model provider', sem.provider || 'none'], ['live model calls / cache hits / errors', `${sem.calls ?? '-'} / ${sem.cacheHits ?? '-'} / ${sem.errors ?? '-'}`],
      ['tokens in / out (live calls)', `${sem.inputTokens ?? '-'} / ${sem.outputTokens ?? '-'}`], ['valid', manifest.valid === false ? `**NO** - ${manifest.invalidReason}` : 'yes'],
      ['environment', manifest.env],
    ]) L.push(`| ${k} | ${v} |`);
    L.push('');
    if (/offline/i.test(sem.provider || '')) L.push('> **The model here is the offline word-overlap STUB, not a language model. Do not quote these as a model result.**', '');
  }
  L.push('| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |', '|---|---|---|---|---|---|---|---|---|');
  for (const a of sortRows(rows)) {
    L.push(`| ${a.config} | ${a.arm} | ${a.n} | ${fmtCI(a.full, a.n)} | ${(a.wrong / a.n).toFixed(2)} | ${(a.silent / a.n).toFixed(2)} | ${(a.inj / a.n).toFixed(2)} | ${(a.calls / a.n).toFixed(2)} | ${Math.round(a.ms / a.n)} |`);
  }
  L.push('', '**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.');
  return L.join('\n') + '\n';
}

export function csvOf(rows) {
  const H = 'config,arm,flows,completed,completed_pct,ci95_lo,ci95_hi,wrong_per_run,silent_per_run,planted_taps_per_run,model_calls_per_run,ms_per_run';
  return [H, ...sortRows(rows).map((a) => { const w = wilson(a.full, a.n); return [a.config, a.arm, a.n, a.full, pct(w.p), pct(w.lo), pct(w.hi), (a.wrong / a.n).toFixed(3), (a.silent / a.n).toFixed(3), (a.inj / a.n).toFixed(3), (a.calls / a.n).toFixed(3), Math.round(a.ms / a.n)].join(','); })].join('\n') + '\n';
}

// ---- manifest ------------------------------------------------------------------------------
const git = (...a) => spawnSync('git', a, { cwd: REPO, encoding: 'utf8' });
export function buildManifest({ command, set, arms, n, semantic, valid, invalidReason, extra = {} }) {
  const head = git('rev-parse', 'HEAD'), dirty = git('status', '--porcelain');
  const harness = path.join(REPO, 'fyp-mvp', 'harness.js');
  return {
    date: new Date().toISOString(),
    git: { commit: (head.stdout || '').trim() || 'unknown', dirty: !!(dirty.stdout || '').trim() },
    harnessSha256: fs.existsSync(harness) ? crypto.createHash('sha256').update(fs.readFileSync(harness)).digest('hex') : null,
    command, set, arms, n, semantic: semantic || null, valid: valid !== false, invalidReason: invalidReason || null,
    env: `node ${process.version}, ${process.platform}`, ...extra,
  };
}

// ---- CLI ---------------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(path.join(dir, 'results.json'))) { console.error('usage: node agent/report.mjs <resultsDir containing results.json> [--publish <name>]'); process.exit(2); }
  const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
  const manifest = fs.existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : null;
  const name = path.basename(path.resolve(dir));
  const rows = aggregate(results);
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(rows, manifest, name));
  fs.writeFileSync(path.join(dir, 'report.csv'), csvOf(rows));
  console.log(`wrote ${path.join(dir, 'report.md')} (${rows.length} config x arm rows)`);
  const i = process.argv.indexOf('--publish');
  if (i > 0 && process.argv[i + 1]) {
    const dest = path.join(REPO, 'results', 'published', process.argv[i + 1]);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(dir)) if (/\.(json|csv|md)$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join(dest, f));
    console.log('published to ' + path.relative(REPO, dest));
  }
}
