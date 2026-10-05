#!/usr/bin/env bash
# RFC-033 — build the native C-ABI static library for the Go mirrors.
#
# Compiles packages/core-wasm (Rust) with the `staticlib` crate type and stages
# the archive + header where the Go cgo package expects them:
#   native/core-ffi/lib/libtotemsdk_core_ffi.a
#   native/core-ffi/include/totem_ffi.h
#
# Usage: scripts/build-core-ffi.sh [debug|release]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${1:-release}"
CRATE_DIR="$ROOT_DIR/packages/core-wasm"
STAGE="$ROOT_DIR/native/core-ffi"

if ! command -v cargo >/dev/null 2>&1; then
  echo "build-core-ffi: cargo not found (install Rust: https://rustup.rs)" >&2
  exit 1
fi

if [[ "$PROFILE" == "release" ]]; then
  cargo build --manifest-path "$CRATE_DIR/Cargo.toml" --lib --release
  LIB="$CRATE_DIR/target/release/libtotemsdk_core_wasm.a"
else
  cargo build --manifest-path "$CRATE_DIR/Cargo.toml" --lib
  LIB="$CRATE_DIR/target/debug/libtotemsdk_core_wasm.a"
fi

if [[ ! -f "$LIB" ]]; then
  echo "build-core-ffi: expected archive not found at $LIB" >&2
  exit 1
fi

mkdir -p "$STAGE/lib" "$STAGE/include"
cp "$LIB" "$STAGE/lib/libtotemsdk_core_ffi.a"
cp "$CRATE_DIR/include/totem_ffi.h" "$STAGE/include/totem_ffi.h"

echo "build-core-ffi: staged $(basename "$LIB") ($PROFILE) -> $STAGE"
