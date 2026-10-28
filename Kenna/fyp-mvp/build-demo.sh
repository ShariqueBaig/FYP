#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build the FYP demo.
#
#   1. Export the mock Instagram app for web (Expo).
#   2. Drop the harness into the build output.
#   3. Inject a <script> tag that loads it after the app bundle.
#
# The harness is injected, not compiled into the app - it drives the app from
# outside, which is what makes the demo convincing. Re-run this after any change
# to App.tsx or harness.js.
#
# Usage:  bash fyp-mvp/build-demo.sh
# Then:   python3 -m http.server 8081 --directory "insta clone/dist"
#         open    http://127.0.0.1:8081/?demo=1
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/insta clone"
DIST="$APP/dist"

if [ ! -d "$APP/node_modules" ]; then
  echo "!! $APP/node_modules is missing - run 'npm install' there first." >&2
  exit 1
fi

# The demo runs offline and never logs in, but App.tsx compiles liveConfig.ts
# (the live Firebase login) into the bundle. Build with a blank one so the
# published bundle can never carry a credential; the real file is restored on exit.
LIVE="$APP/liveConfig.ts"
if [ -f "$LIVE" ]; then
  LIVE_BAK="$(mktemp)"
  cp "$LIVE" "$LIVE_BAK"
  trap 'cp "$LIVE_BAK" "$LIVE"; rm -f "$LIVE_BAK"' EXIT
fi
cat > "$LIVE" <<'TS'
// Credential-free stand-in used only while building the demo bundle.
export const LIVE_LOGIN = { email: '', password: '' };
export const USE_STORAGE = false;
TS

echo "==> 1/3  exporting the mock app for web"
( cd "$APP" && CI=1 BROWSER=none EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web )

echo "==> 2/3  copying the harness into the build"
cp "$ROOT/fyp-mvp/harness.js" "$DIST/fyp-harness.js"
# Vendored so the failure screenshot works offline (loaded lazily by the harness).
cp "$ROOT/fyp-mvp/vendor/html2canvas.min.js" "$DIST/fyp-html2canvas.min.js"

echo "==> 3/3  wiring the harness into index.html"
python3 - "$DIST/index.html" <<'PY'
import io, sys
path = sys.argv[1]
html = io.open(path, encoding='utf-8').read()
tag = '<script src="/fyp-harness.js" defer></script>'
if 'fyp-harness.js' in html:
    print('  already wired - nothing to do')
else:
    if '</body>' in html:
        html = html.replace('</body>', tag + '\n</body>')
    else:
        html += '\n' + tag + '\n'
    io.open(path, 'w', encoding='utf-8').write(html)
    print('  injected <script src="/fyp-harness.js">')
PY

echo
echo "done. Serve it with:"
echo "  python3 -m http.server 8081 --directory \"$DIST\""
echo "then open:  http://127.0.0.1:8081/?demo=1"
