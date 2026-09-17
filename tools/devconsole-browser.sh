#!/usr/bin/env bash
# Open the Chrome Web Store developer console in a headed Chrome for Testing with its own profile,
# exposing CDP on :9333 so tools/devconsole.mjs can drive it after you sign in.
# Google Chrome (branded) blocks remote debugging on its default profile; this avoids touching it.
set -euo pipefail
PROFILE="${DEVCONSOLE_PROFILE:-$HOME/Library/Application Support/jarvis-browser/devconsole-profile}"
PORT="${DEVCONSOLE_PORT:-9333}"   # a second profile (e.g. a public persona) can run beside it on another port
URL="${1:-https://chrome.google.com/webstore/devconsole}"
BIN="$(node -e "import('playwright').then(p => console.log(p.chromium.executablePath()))" 2>/dev/null)"
[ -x "$BIN" ] || { echo "Chrome for Testing not found; run: npx playwright install chromium" >&2; exit 1; }
mkdir -p "$PROFILE"
nohup "$BIN" --user-data-dir="$PROFILE" --remote-debugging-port="$PORT" --no-first-run --no-default-browser-check \
  --window-size=1440,1000 --window-position=200,60 "$URL" >/dev/null 2>&1 &
disown
sleep 3 && curl -s "http://localhost:$PORT/json/version" | head -3
