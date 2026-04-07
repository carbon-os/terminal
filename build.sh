#!/bin/bash
set -e

# ── Args ──────────────────────────────────────────────────────────────────────
BUILD_TYPE=Debug
for arg in "$@"; do
    [[ "$arg" == "--release" ]] && BUILD_TYPE=Release
done

# ── Platform ──────────────────────────────────────────────────────────────────
OS="$(uname -s)"

# ── vcpkg ─────────────────────────────────────────────────────────────────────
VCPKG_ROOT="${VCPKG_ROOT:-$HOME/.vcpkg}"

if [ ! -f "$VCPKG_ROOT/vcpkg" ]; then
    echo "→ bootstrapping vcpkg at $VCPKG_ROOT ..."
    git clone --depth 1 https://github.com/microsoft/vcpkg.git "$VCPKG_ROOT"
    "$VCPKG_ROOT/bootstrap-vcpkg.sh" -disableMetrics
fi

TOOLCHAIN="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"

# ── App icon (macOS only) ─────────────────────────────────────────────────────
if [[ "$OS" == "Darwin" ]]; then
    ICON_PNG="resources/assets/logo.png"
    ICON_ICNS="resources/assets/logo.icns"

    if [ "$ICON_PNG" -nt "$ICON_ICNS" ] 2>/dev/null || [ ! -f "$ICON_ICNS" ]; then
        echo "→ generating app icon..."
        (cd utils && npm install --silent)
        node utils/format_icon.js
    else
        echo "→ app icon up to date, skipping"
    fi
fi

# ── Web frontend ──────────────────────────────────────────────────────────────
echo "→ building web frontend..."
(cd app/frontend && npm install --silent && npm run build)

# ── Native ────────────────────────────────────────────────────────────────────
echo "→ building native ($BUILD_TYPE) on $OS..."
cmake -S . -B build \
    -DCMAKE_BUILD_TYPE=$BUILD_TYPE \
    -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN"
cmake --build build

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
if [[ "$OS" == "Darwin" ]]; then
    echo "✓ Built → ./build/CarbonTerminal.app/Contents/MacOS/CarbonTerminal"
elif [[ "$OS" == "Linux" ]]; then
    echo "✓ Built → ./build/CarbonTerminal"
fi