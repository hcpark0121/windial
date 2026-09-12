#!/usr/bin/env bash
# Zip the extension for the Chrome Web Store. Only ships what the manifest needs.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT/manifest.json','utf8')).version")"
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/windial-$VERSION.zip"
rm -f "$OUT"
( cd "$ROOT" && zip -r -X -q "$OUT" manifest.json _locales icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png src -x '*.DS_Store' )
echo "$OUT"
unzip -l "$OUT" | tail -n +2
