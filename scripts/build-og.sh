#!/bin/bash
# Renders site/assets/og.jpg (the social card) from the live hero.
# Needs the site served locally: python3 -m http.server 5175 -d site
set -e
URL="${1:-http://127.0.0.1:5175/?og}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/site/assets/og.jpg"
TMP="$(mktemp -d)"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu-sandbox \
	--use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=1200,630 \
	--virtual-time-budget=6500 --screenshot="$TMP/og.png" "$URL" >/dev/null 2>&1
sips -s format jpeg -s formatOptions 88 "$TMP/og.png" --out "$OUT" >/dev/null
rm -rf "$TMP"
echo "Wrote $OUT"
