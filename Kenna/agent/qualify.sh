#!/usr/bin/env bash
# Qualify a model before spending on the full protocol: a small, hard, fully logged run.
#
#   bash Kenna/agent/qualify.sh [model]        default qwen/qwen3.7-flash (provider: openrouter)
#
# Web steps (no emulator needed): reskin / planted instructions / no words, with the model's default reasoning,
# with reasoning off, and with a screenshot. Every model decision is logged (calls_*.jsonl); credit is read from
# OpenRouter before and after so the cost is exact. Output: agent/results/qualification/<slug>/
set -u
cd "$(dirname "$0")/.."
MODEL="${1:-qwen/qwen3.7-flash}"
SLUG="$(echo "$MODEL" | tr '/:.' '___')"
OUT="agent/results/qualification/$SLUG"
mkdir -p "$OUT"
export FYP_SEMANTIC_MIN_GAP_MS="${FYP_SEMANTIC_MIN_GAP_MS:-0}"   # a paid key has no 50/day cap

credit () {  # prints total_usage in USD, never the key
  local key; key=$(grep -v '^#' agent/openrouter.key | head -1 | tr -d '\r\n ')
  curl -s https://openrouter.ai/api/v1/credits -H "Authorization: Bearer $key" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).data.total_usage)}catch(e){console.log("NaN")}})'
}
U0=$(credit); echo "credit used before: $U0" | tee "$OUT/cost.txt"

run () {  # name, extra env assignment (or "-"), then args
  local name="$1" envs="$2"; shift 2
  echo "=== $name ==="
  ( [ "$envs" != "-" ] && export $envs; node agent/fyp.mjs "$@" --semantic openrouter --semantic-model "$MODEL" \
      --semantic-cache "$OUT/cache_$name.json" --semantic-log "$OUT/calls_$name.jsonl" --out "$OUT/$name" \
      > "$OUT/$name.stdout.json" 2> "$OUT/$name.stderr.txt" )
  local valid; valid=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).valid)}catch(e){console.log("unknown")}' "$OUT/$name.stdout.json")
  echo "    valid=$valid"
  node agent/call_log_summary.mjs "$OUT/calls_$name.jsonl" > "$OUT/summary_$name.txt" 2>&1 || true
  head -6 "$OUT/summary_$name.txt" | sed 's/^/    /'
}

run web_default   -                          experiment --n 1 --set qual --arms healed,llm-only,model-verified,hybrid
run web_noreason  FYP_SEMANTIC_REASONING=off experiment --n 1 --set qual --arms healed,llm-only,model-verified,hybrid
run web_shot      -                          experiment --n 1 --set qual --arms llm-only,hybrid --semantic-shot

U1=$(credit); echo "credit used after:  $U1" | tee -a "$OUT/cost.txt"
node -e 'console.log("TOTAL COST of this qualification: $"+(Number(process.argv[2])-Number(process.argv[1])).toFixed(5))' "$U0" "$U1" | tee -a "$OUT/cost.txt"
echo "done. Reports: $OUT/*/report.md   decisions: node agent/call_log_summary.mjs $OUT/calls_web_default.jsonl --decisions"
