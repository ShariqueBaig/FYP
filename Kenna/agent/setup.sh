#!/usr/bin/env bash
# One-time setup for a fresh checkout: Playwright + Chromium. Needs Node >= 18.
# On a bare Linux box pass --with-deps to also install the browser's system libraries.
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "node is required (>=18)" >&2; exit 2; }
npm install --no-audit --no-fund
if [ "${1:-}" = "--with-deps" ]; then npx playwright install --with-deps chromium; else npx playwright install chromium; fi
echo "ok - try: node agent/fyp.mjs describe"
