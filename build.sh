#!/bin/bash
set -e

# ── App icon ──────────────────────────────────────────────────────────────────
ICON_PNG="resources/assets/logo.png"
ICON_ICNS="resources/assets/logo.icns"

if [ "$ICON_PNG" -nt "$ICON_ICNS" ] 2>/dev/null || [ ! -f "$ICON_ICNS" ]; then
    echo "→ generating app icon..."
    (cd utils && npm install --silent)
    node utils/format_icon.js
else
    echo "→ app icon up to date, skipping"
fi

# ── Web frontend ──────────────────────────────────────────────────────────────
echo "→ building web frontend..."
(cd app/frontend && npm install --silent && npm run build)

# ── Native ────────────────────────────────────────────────────────────────────
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build

echo ""
echo "✓ Built → ./build/CarbonTerminal.app/Contents/MacOS/CarbonTerminal"