#!/usr/bin/env node
// Summarise a --semantic-log JSONL file (one line per model decision): volume, cost, latency, confidence, errors,
// and every decision in words. Use it to audit a run: nothing here is estimated, it is all read from the log.
//
//   node agent/call_log_summary.mjs <calls.jsonl> [--decisions]
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('usage: node agent/call_log_summary.mjs <calls.jsonl> [--decisions]'); process.exit(2); }
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const q = (xs, p) => { if (!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const live = rows.filter((r) => !r.cached), cached = rows.filter((r) => r.cached), failed = rows.filter((r) => r.error);
const ok = live.filter((r) => !r.error);
const tin = sum(ok.map((r) => (r.usage && r.usage.inputTokens) || 0)), tout = sum(ok.map((r) => (r.usage && r.usage.outputTokens) || 0));
const reasoning = sum(ok.map((r) => (r.usage && r.usage.reasoningTokens) || 0));
const cost = sum(ok.map((r) => (r.usage && r.usage.costUsd) || 0));
const lat = ok.map((r) => r.ms);
const tops = ok.filter((r) => r.picks.length).map((r) => r.picks[0].confidence);
const empty = ok.filter((r) => !r.picks.length).length;

const L = [];
L.push(`file: ${file}`);
L.push(`models: ${[...new Set(rows.map((r) => r.model))].join(', ')}`);
L.push(`decisions: ${rows.length}  (live ${live.length}, cached ${cached.length}, failed ${failed.length})`);
L.push(`tokens (live, ok): in ${tin}, out ${tout} (of which reasoning ${reasoning})   cost: $${cost.toFixed(5)} (as reported by the API)`);
L.push(`latency ms (live, ok): p50 ${q(lat, 0.5)}  p95 ${q(lat, 0.95)}  max ${Math.max(0, ...lat)}`);
L.push(`answers that named no control: ${empty}/${ok.length}   top-pick confidence: median ${q(tops, 0.5).toFixed(2)}, min ${Math.min(1, ...tops).toFixed(2)}`);
if (failed.length) L.push(`FAILURES: ${[...new Set(failed.map((r) => r.error))].join(' | ')}`);
const by = {};
for (const r of ok) { const id = (r.intent && r.intent.id) || r.task; (by[id] = by[id] || []).push(r); }
L.push('', 'per intent: calls, mean options offered, mean ms, mean top confidence');
for (const [id, rs] of Object.entries(by)) {
  L.push(`  ${id.padEnd(18)} ${String(rs.length).padStart(3)}  options ${(sum(rs.map((r) => r.nOptions)) / rs.length).toFixed(0).padStart(3)}  ${(sum(rs.map((r) => r.ms)) / rs.length).toFixed(0).padStart(6)} ms  conf ${(sum(rs.filter((r) => r.picks.length).map((r) => r.picks[0].confidence)) / Math.max(1, rs.filter((r) => r.picks.length).length)).toFixed(2)}`);
}
if (process.argv.includes('--decisions')) {
  L.push('', 'every decision (goal -> first pick):');
  for (const r of rows) {
    const p = r.picks[0];
    L.push(`  ${r.cached ? 'c' : r.error ? '!' : ' '} ${((r.intent && r.intent.id) || r.task).padEnd(16)} "${(r.intent && r.intent.desc) || ''}" -> ${p ? `#${p.i} [${p.tag}] "${(p.label || p.text || '').slice(0, 40)}" conf ${Number(p.confidence).toFixed(2)}` : r.error ? 'ERROR ' + r.error : '(none)'}`);
  }
}
console.log(L.join('\n'));
