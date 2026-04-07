#!/bin/bash
set -e

# ── Args ──────────────────────────────────────────────────────────────────────
BUILD_TYPE=Debug
for arg in "$@"; do
    [[ "$arg" == "--release" ]] && BUILD_TYPE=Release
done

# ── vcpkg ─────────────────────────────────────────────────────────────────────
VCPKG_ROOT="${VCPKG_ROOT:-$HOME/.vcpkg}"

if [ ! -f "$VCPKG_ROOT/vcpkg" ]; then
    echo "→ bootstrapping vcpkg at $VCPKG_ROOT ..."
    git clone --depth 1 https://github.com/microsoft/vcpkg.git "$VCPKG_ROOT"
    "$VCPKG_ROOT/bootstrap-vcpkg.sh" -disableMetrics
fi

TOOLCHAIN="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"

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
echo "→ building native ($BUILD_TYPE)..."
cmake -S . -B build -G Ninja \
    -DCMAKE_BUILD_TYPE=$BUILD_TYPE \
    -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN"
cmake --build build

echo ""
echo "✓ Built → ./build/CarbonTerminal.app/Contents/MacOS/CarbonTerminal"