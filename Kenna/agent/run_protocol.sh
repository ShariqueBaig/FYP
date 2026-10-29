#!/usr/bin/env bash
# The real-model evaluation protocol for the FYP defense, in one resumable command.
#
#   bash Kenna/agent/run_protocol.sh [provider] [model]        e.g.  openrouter qwen/qwen3.7-flash
#
# * Every answer the model gives is cached on disk (agent/results/protocol/cache_<model>.json), so a re-run
#   costs nothing for what was already paid for and only retries the gaps. If a step reports INVALID (rate limit,
#   daily cap, no credit) just run the same command again later.
# * Every step writes results.json, manifest.json, report.md, report.csv into agent/results/protocol/<name>/.
#   Publish a finished step with:  node Kenna/agent/report.mjs <dir> --publish <name>
# * Key: ANTHROPIC_API_KEY / OPENROUTER_API_KEY in the environment, or agent/anthropic.key / agent/openrouter.key.
#   An AI agent with its own key in its backend should export it and run this itself; never ask the user for a key.
#
# Rough size of one pass (temperature 0, so repetitions hit the cache): about 300-600 DISTINCT model calls.
# OpenRouter's free tier allows 50 requests/day (1000/day after adding $10 credit): plan accordingly.
set -u
cd "$(dirname "$0")/.."
# Qualification (qwen/qwen3.7-flash, n=1 on 3 hard configs): thinking tokens off is ~5x faster and half the cost with the same
# or better outcomes, so it is the default here. Paid keys have no 50/day cap, so no pacing. Override by exporting these first.
export FYP_SEMANTIC_REASONING="${FYP_SEMANTIC_REASONING:-off}"
export FYP_SEMANTIC_MIN_GAP_MS="${FYP_SEMANTIC_MIN_GAP_MS:-0}"
PROVIDER="${1:-openrouter}"
MODEL="${2:-}"
SLUG="$(echo "${MODEL:-default}" | tr '/:.' '___')"
OUT="agent/results/protocol"
CACHE="$OUT/cache_${PROVIDER}_${SLUG}.json"
MFLAG=""; [ -n "$MODEL" ] && MFLAG="--semantic-model $MODEL"
mkdir -p "$OUT"

step () {  # name, then fyp.mjs args
  local name="$1"; shift
  echo "=== $name ==="
  node agent/fyp.mjs "$@" --semantic "$PROVIDER" $MFLAG --semantic-cache "$CACHE" --out "$OUT/${name}_${SLUG}" \
     > "$OUT/${name}_${SLUG}.stdout.json" 2> "$OUT/${name}_${SLUG}.stderr.txt"
  local valid; valid=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).valid)}catch(e){console.log("unknown")}' "$OUT/${name}_${SLUG}.stdout.json")
  echo "    valid=$valid   (report: $OUT/${name}_${SLUG}/report.md)"
  if [ "$valid" != "true" ]; then
    echo "    STOPPED: this step is not valid. Reason:"; node -e 'try{console.log("    "+JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).invalidReason)}catch(e){}' "$OUT/${name}_${SLUG}.stdout.json"
    echo "    Fix the cause (quota/credit/key) and run the same command again: the cache keeps everything already answered."
    exit 3
  fi
}

# H1/H2: rules vs model vs verification, under drift the rules cannot read (B9 reword, B10 relocate, B1 id rot)
step semantic_n10   experiment --n 10 --set semantic --arms baseline,healed,llm-only,model-verified,hybrid
# Safety: planted instructions in labels (B11): does the model obey, and does the check catch it?
step inject_n10     experiment --n 10 --set inject   --arms healed,llm-only,model-verified,hybrid
# Vision: words gone entirely; compare text-only against screenshot + numbered badges (needs a vision model)
step vision_text_n5 experiment --n 5  --set vision   --arms healed,llm-only,hybrid
step vision_shot_n5 experiment --n 5  --set vision   --arms healed,llm-only,hybrid --semantic-shot
# H3: does remembering a model answer cut model calls once the UI has changed?
echo "=== distillation (learn) ==="
node agent/fyp.mjs learn --runs 8 --drift-at 2 --breaks B1,B9,B10 --semantic "$PROVIDER" $MFLAG --semantic-cache "$CACHE" --out "$OUT/learn_${SLUG}" \
   > "$OUT/learn_${SLUG}.stdout.json" 2> "$OUT/learn_${SLUG}.stderr.txt" && echo "    done: $OUT/learn_${SLUG}/learn.json"
echo "All steps finished. Publish the ones you will cite:  node agent/report.mjs $OUT/<step>_${SLUG} --publish <name>"
