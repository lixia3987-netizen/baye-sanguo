#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$ROOT/vendor/iBaye"
BUILD="$ROOT/build/wasm"
JOBS="${JOBS:-$(nproc)}"
STAGE_ONLY=false
if [ "${1:-}" = "--stage-only" ]; then
  STAGE_ONLY=true
elif [ "$#" -gt 0 ]; then
  echo "Usage: $0 [--stage-only]" >&2
  exit 1
fi

if ! command -v emcmake >/dev/null 2>&1; then
  if [ -n "${BAYE_EMSDK_ROOT:-}" ] && [ -f "$BAYE_EMSDK_ROOT/emsdk_env.sh" ]; then
    # shellcheck disable=SC1091
    source "$BAYE_EMSDK_ROOT/emsdk_env.sh"
  elif [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
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

SDK_VERSION="$(emcc --version | python3 -c 'import re,sys; print(re.search(r"\b\d+\.\d+\.\d+\b",sys.stdin.read()).group(0))')"
if [ "$SDK_VERSION" != "3.1.51" ]; then
  echo "Expected Emscripten 3.1.51, got $SDK_VERSION" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node is required to validate WASM and record build provenance" >&2
  exit 1
fi
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git -C "$ROOT" log -1 --format=%ct)}"
# This generated header depends on the build timestamp. Regenerate it when
# changing SOURCE_DATE_EPOCH instead of reusing a previous CMake output.
rm -f "$ENGINE/src/baye/version.h"
mkdir -p "$BUILD"
cd "$BUILD"
emcmake cmake "$ENGINE"
cmake --build . -- -j"$JOBS"

OUT="$BUILD/src/baye.wasm"
JS="$BUILD/src/baye.js"
if [ ! -s "$OUT" ] || [ ! -s "$JS" ]; then
  echo "build finished but baye.wasm / baye.js were not found under $BUILD" >&2
  exit 1
fi

git -C "$ROOT" ls-files -z vendor/iBaye > "$BUILD/engine-source-files"
SOURCE_REVISION="$(git -C "$ROOT" rev-parse HEAD)"
ENGINE_SOURCE_MODIFIED="$(git -C "$ROOT" diff --name-only HEAD -- vendor/iBaye)"
CMAKE_VERSION="$(cmake --version | sed -n '1p')"
node "$ROOT/scripts/write-wasm-manifest.mjs" "$BUILD/src" "$SDK_VERSION" \
  "$BUILD/engine-source-files" "$SOURCE_REVISION" "$CMAKE_VERSION" "$ENGINE_SOURCE_MODIFIED"
if "$STAGE_ONLY"; then
  echo "Validated staged artifacts: $BUILD/src"
  exit 0
fi
cp -f "$JS" "$ROOT/js/baye.js"
cp -f "$OUT" "$ROOT/js/baye.wasm"
if [ -f "${OUT}.map" ]; then
  cp -f "${OUT}.map" "$ROOT/js/baye.wasm.map"
fi
cp -f "$BUILD/src/baye.build.json" "$ROOT/js/baye.build.json"

echo "Installed:"
ls -lh "$ROOT/js/baye.js" "$ROOT/js/baye.wasm"
