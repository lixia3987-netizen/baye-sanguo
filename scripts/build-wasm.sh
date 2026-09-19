#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$ROOT/vendor/iBaye"
BUILD="$ROOT/build/wasm"
JOBS="${JOBS:-$(nproc)}"

if ! command -v emcmake >/dev/null 2>&1; then
  if [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
    # shellcheck disable=SC1091
    source "$HOME/emsdk/emsdk_env.sh"
  elif [ -f /opt/emsdk/emsdk_env.sh ]; then
    # shellcheck disable=SC1091
    source /opt/emsdk/emsdk_env.sh
  fi
fi

if ! command -v emcmake >/dev/null 2>&1; then
  echo "emcmake not found. Install emsdk 3.1.51 and source emsdk_env.sh" >&2
  echo "See docs/wasm-build.md" >&2
  exit 1
fi

mkdir -p "$BUILD"
cd "$BUILD"
emcmake cmake "$ENGINE"
cmake --build . -- -j"$JOBS"

OUT="$(find "$BUILD" -name 'baye.wasm' | head -n 1)"
JS="$(find "$BUILD" -name 'baye.js' | head -n 1)"
if [ -z "$OUT" ] || [ -z "$JS" ]; then
  echo "build finished but baye.wasm / baye.js were not found under $BUILD" >&2
  exit 1
fi

cp -f "$JS" "$ROOT/js/baye.js"
cp -f "$OUT" "$ROOT/js/baye.wasm"
if [ -f "${OUT}.map" ]; then
  cp -f "${OUT}.map" "$ROOT/js/baye.wasm.map"
fi

echo "Installed:"
ls -lh "$ROOT/js/baye.js" "$ROOT/js/baye.wasm"
