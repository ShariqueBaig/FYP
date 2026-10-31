#!/usr/bin/env bash
# The real-model protocol steps, run at the same time instead of one after another (about 12 cores and 4 GB are enough for five).
# Same commands and flags as run_protocol.sh; each step gets its OWN copy of the answer cache so two processes never write one file.
#
#   bash Kenna/agent/run_parallel.sh [provider] [model] [steps...]      e.g.  openrouter qwen/qwen3.7-flash inject vision_text vision_shot learn rules
#
# Steps: semantic inject vision_text vision_shot learn rules   (default: inject vision_text vision_shot learn rules)
# Each step writes agent/results/protocol/<step>_<model>/ exactly as run_protocol.sh does and a status line in <step>.status.
# A step whose report says valid=false (for example network failures) is not to be quoted: rerun just that step.
set -u
cd "$(dirname "$0")/.."
export FYP_SEMANTIC_REASONING="${FYP_SEMANTIC_REASONING:-off}"
export FYP_SEMANTIC_MIN_GAP_MS="${FYP_SEMANTIC_MIN_GAP_MS:-0}"
PROVIDER="${1:-openrouter}"; MODEL="${2:-qwen/qwen3.7-flash}"; shift 2 2>/dev/null || true
STEPS=("$@"); [ ${#STEPS[@]} -eq 0 ] && STEPS=(inject vision_text vision_shot learn rules)
SLUG="$(echo "$MODEL" | tr '/:.' '___')"
OUT="agent/results/protocol"; BASE_CACHE="$OUT/cache_${PROVIDER}_${SLUG}.json"
MFLAG="--semantic-model $MODEL"
mkdir -p "$OUT"

one () {  # name, then fyp.mjs args (no provider flags for rules)
  local name="$1"; shift
  local cache="$OUT/cache_${name}_${SLUG}.json"
  [ -f "$BASE_CACHE" ] && cp "$BASE_CACHE" "$cache"
  local dir="$OUT/${name}_${SLUG}"
  if [ "$name" = "rules_full_n10" ]; then
    node agent/fyp.mjs "$@" --out "$OUT/$name" > "$OUT/$name.stdout.json" 2> "$OUT/$name.stderr.txt"
    echo "$name exit=$?" > "$OUT/$name.status"; return
  fi
  if [ "$name" = "learn" ]; then
    node agent/fyp.mjs "$@" --semantic "$PROVIDER" $MFLAG --semantic-cache "$cache" --out "$dir" > "$OUT/${name}_${SLUG}.stdout.json" 2> "$OUT/${name}_${SLUG}.stderr.txt"
    echo "learn exit=$?" > "$OUT/$name.status"; return
  fi
  node agent/fyp.mjs "$@" --semantic "$PROVIDER" $MFLAG --semantic-cache "$cache" --out "$dir" > "$OUT/${name}_${SLUG}.stdout.json" 2> "$OUT/${name}_${SLUG}.stderr.txt"
  local valid; valid=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).valid)}catch(e){console.log("unknown")}' "$OUT/${name}_${SLUG}.stdout.json")
  echo "$name valid=$valid" > "$OUT/$name.status"
}

for s in "${STEPS[@]}"; do
  rm -f "$OUT/$s.status" "$OUT/$( [ "$s" = rules ] && echo rules_full_n10 || echo "$s" ).status"
  case "$s" in
    semantic)    one semantic_n10   experiment --n 10 --set semantic --arms baseline,healed,llm-only,model-verified,hybrid & ;;
    inject)      one inject_n10     experiment --n 10 --set inject   --arms healed,llm-only,model-verified,hybrid & ;;
    vision_text) one vision_text_n5 experiment --n 5  --set vision   --arms healed,llm-only,hybrid & ;;
    vision_shot) one vision_shot_n5 experiment --n 5  --set vision   --arms healed,llm-only,hybrid --semantic-shot & ;;
    learn)       one learn          learn --runs 8 --drift-at 2 --breaks B1,B9,B10 & ;;
    rules)       one rules_full_n10 experiment --n 10 --set full --arms baseline,healed & ;;
    *) echo "unknown step $s" ;;
  esac
done
wait
echo "all requested steps ended"; cat "$OUT"/*.status 2>/dev/null
