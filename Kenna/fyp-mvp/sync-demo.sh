#!/usr/bin/env bash
# Copy the freshly built app (insta clone/dist) into the committed, prebuilt
# demo/ folder that the agent runner serves. The harness is NOT copied: the
# runner serves fyp-mvp/harness.js directly, so it can never be stale.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/insta clone/dist"
DST="$ROOT/demo"
[ -f "$SRC/index.html" ] || { echo "!! run build-demo.sh first ($SRC/index.html missing)" >&2; exit 1; }
rm -rf "$DST"
mkdir -p "$DST"
cp -r "$SRC/." "$DST/"
rm -f "$DST/fyp-harness.js" "$DST/fyp-html2canvas.min.js"
grep -q 'fyp-harness.js' "$DST/index.html" || { echo "!! index.html lacks the harness tag" >&2; exit 1; }
echo "demo/ updated from dist ($(du -sh "$DST" | cut -f1))"
