#!/usr/bin/env bash
# Assemble site/ = demo/ + the live harness, ready to drag onto Netlify,
# Cloudflare Pages or Vercel. Never includes liveConfig.ts or any source.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/site"
[ -f "$ROOT/demo/index.html" ] || { echo "!! demo/ missing" >&2; exit 1; }
node --check "$ROOT/fyp-mvp/harness.js"
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$ROOT/demo/." "$OUT/"
cp "$ROOT/fyp-mvp/harness.js" "$OUT/fyp-harness.js"
cp "$ROOT/fyp-mvp/vendor/html2canvas.min.js" "$OUT/fyp-html2canvas.min.js"
printf '/*  /index.html  200\n' > "$OUT/_redirects"          # Netlify / Cloudflare SPA fallback
printf '/*\n  Cache-Control: no-cache\n' > "$OUT/_headers"    # never serve a stale bundle
cat > "$OUT/vercel.json" <<'J'
{"headers":[{"source":"/(.*)","headers":[{"key":"Cache-Control","value":"no-cache"}]}],"rewrites":[{"source":"/((?!_expo|assets|fyp-).*)","destination":"/index.html"}]}
J
echo "site/ ready ($(du -sh "$OUT" | cut -f1)). Open: <your-url>/?demo=1"
