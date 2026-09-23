#!/usr/bin/env bash
#
# Build every contract in the workspace, run its tests, and deploy one of them
# to a network. Reproducible: the same sources and the same pinned toolchain
# produce the same Wasm.
#
# Defaults to the local network, which is what development and CI use. Pass
# `NETWORK=testnet` for the demo evidence.
#
# Usage:
#   ./deploy-local.sh [-- <constructor args>...]
#   NETWORK=testnet SOURCE_ACCOUNT=vaqcrow-deployer ./deploy-local.sh -- 1000
#
set -euo pipefail

NETWORK="${NETWORK:-local}"
SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-vaqcrow-deployer}"
PACKAGE="${PACKAGE:-campaign-vault}"

# Resolve from this script's location so it works from any working directory.
CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$CONTRACTS_DIR"

# Accept both `./deploy-local.sh --goal=1000` and `./deploy-local.sh -- --goal=1000`.
# A leading `--` belongs to the Stellar CLI, not to this script; forwarding it
# would send a stray `--` as a constructor argument.
if [ "${1:-}" = "--" ]; then
  shift
fi

# rustup reads rust-toolchain.toml from the current directory upwards, so the
# pinned toolchain and the wasm32v1-none target resolve from here.
echo "== toolchain =="
rustc --version
rustup target list --installed | grep wasm32v1-none

if ! stellar keys address "$SOURCE_ACCOUNT" >/dev/null 2>&1; then
  echo "== the source account does not exist yet: generating and funding it =="
  stellar keys generate "$SOURCE_ACCOUNT" --network "$NETWORK" --fund
fi
echo "== source account =="
stellar keys address "$SOURCE_ACCOUNT"

echo "== build =="
stellar contract build

echo "== test =="
cargo test --quiet

WASM="target/wasm32v1-none/release/${PACKAGE//-/_}.wasm"
if [ ! -f "$WASM" ]; then
  echo "expected the Wasm at $WASM and it is not there" >&2
  exit 1
fi

echo "== wasm =="
ls -l "$WASM" | awk '{print $5 " bytes"}'
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$WASM"
else
  shasum -a 256 "$WASM"
fi

echo "== deploy to $NETWORK =="
stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$SOURCE_ACCOUNT" \
  --network "$NETWORK" \
  --alias "$PACKAGE" \
  -- "$@"
