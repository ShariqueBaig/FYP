#!/usr/bin/env bash
# Android half of the model qualification: real emulator, real model, every decision logged.
#
#   bash Kenna/path-b/qualify_android.sh [model]      (emulator must be running: python path-b/adb_capture.py devices)
#
# smoke: one intent, exact vs reworded hint | suite: 6 intents x 1 session, 4 arms (stale hints = simulated drift)
# drift: REAL drift, English vs French system language, 5 rows x 1 session x rules/hybrid/llm-only.
# Output: agent/results/qualification/<slug>/android/   (calls.jsonl = every model decision; *.log; *.json)
set -u
cd "$(dirname "$0")"
MODEL="${1:-qwen/qwen3.7-flash}"
SLUG="$(echo "$MODEL" | tr '/:.' '___')"
OUT="../agent/results/qualification/$SLUG/android"
mkdir -p "$OUT"
export PYTHONIOENCODING=utf-8
export FYP_SEMANTIC_LOG="$OUT/calls.jsonl"
export FYP_SEMANTIC_MIN_GAP_MS="${FYP_SEMANTIC_MIN_GAP_MS:-0}"
python adb_capture.py devices || { echo "no device: start the emulator first"; exit 2; }

echo "=== smoke ===";  python -u live_smoke.py --semantic openrouter --semantic-model "$MODEL" 2>&1 | tee "$OUT/smoke.log"
echo "=== suite ===";  python -u live_suite.py --sessions 1 --semantic openrouter --semantic-model "$MODEL" --out "$OUT/suite" 2>&1 | tee "$OUT/suite.log" | tail -8
echo "=== drift ===";  python -u live_drift.py --conditions en,fr --sessions 1 --semantic openrouter --semantic-model "$MODEL" --out "$OUT/drift" 2>&1 | tee "$OUT/drift.log" | tail -12
node ../agent/call_log_summary.mjs "$OUT/calls.jsonl" > "$OUT/summary.txt" 2>&1 || true
python report_android.py "$OUT/suite.json" "$OUT/drift.json" --out "$OUT/report_android.md" 2>&1 | tail -1
echo "done: $OUT"
