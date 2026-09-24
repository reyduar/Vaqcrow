#!/usr/bin/env bash
#
# Bootstrap the campaign vault on the Stellar local network (Quickstart):
# make sure the network is up and registered, create and fund the platform
# identity, deploy the native asset's SAC, build/upload the vault Wasm,
# deploy the factory, and record the public addresses for the docker
# environment profile to pick up (see scripts/env/generate-docker-env.sh
# and docs/architecture/environments.md §"Bóveda de campaña en la red
# local").
#
# It never prints a secret: the platform identity's secret key stays in the
# Stellar CLI keystore (`stellar keys secret vaqcrow-platform`) and this
# script only ever reads its PUBLIC key.
#
# Idempotent enough to re-run: the network/registration/identity/native-SAC
# steps are all skip-if-present, and re-uploading the same Wasm yields the
# same hash. The factory deploy is NOT idempotent — the Stellar CLI has no
# "deploy if absent" mode, so every run deploys a fresh factory instance and
# overwrites contracts/.local-deployment.json with its (different) id. That
# is fine for local development (the old factory and every vault it owns
# just become unreachable from the recorded config), but it is not a
# no-op: re-running this script means re-pointing the docker profile at a
# brand new factory.
#
# Usage:
#   ./bootstrap-local-campaign.sh
#
set -euo pipefail

PLATFORM_IDENTITY="${PLATFORM_IDENTITY:-vaqcrow-platform}"
PORT="${PORT:-8000}"
RPC_URL="http://localhost:${PORT}/rpc"
HORIZON_URL="http://localhost:${PORT}"

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$CONTRACTS_DIR"

QUICKSTART_SCRIPT="${CONTRACTS_DIR}/scripts/local-network.sh"
DEPLOYMENT_FILE="${CONTRACTS_DIR}/.local-deployment.json"

VAULT_WASM="target/wasm32v1-none/release/campaign_vault.wasm"
FACTORY_WASM="target/wasm32v1-none/release/campaign_factory.wasm"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok()   { echo "  ok  $*"; }

# 1. Quickstart itself — start it only when the health check fails, mirroring
#    scripts/local-env.sh's own quickstart_healthy() probe.
echo "== checking the local network on http://localhost:${PORT} =="
if curl -s -X POST "$RPC_URL" -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' --max-time 3 2>/dev/null \
    | grep -q '"status":"healthy"'; then
  ok "already healthy"
else
  echo "== not healthy yet: starting it =="
  "$QUICKSTART_SCRIPT" start
fi

# 2. The `local` CLI network — registering it twice errors, so check first.
echo "== checking the 'local' CLI network is registered =="
if stellar network ls | grep -qx local; then
  ok "already registered"
else
  "$QUICKSTART_SCRIPT" network-add
fi

# 3. The platform identity. A fresh Quickstart container resets the ledger
#    but not the CLI keystore, so an identity can already exist here while
#    being unfunded on THIS incarnation of the network — fund defensively
#    either way rather than assuming "exists" means "funded".
echo "== ensuring the '${PLATFORM_IDENTITY}' identity exists and is funded =="
if stellar keys address "$PLATFORM_IDENTITY" >/dev/null 2>&1; then
  ok "identity already exists"
  if stellar keys fund "$PLATFORM_IDENTITY" --network local >/dev/null 2>&1; then
    ok "funded (or already funded) on this network"
  else
    echo "  fund skipped (most likely already funded on this network)"
  fi
else
  stellar keys generate "$PLATFORM_IDENTITY" --network local --fund
  ok "created and funded"
fi
PLATFORM_PUBLIC_KEY="$(stellar keys address "$PLATFORM_IDENTITY")"
ok "platform public key: ${PLATFORM_PUBLIC_KEY}"

# 4. The native asset's SAC — every fresh network needs it deployed once
#    before any contract can move native XLM. Tolerate it already existing
#    (every run after the first hits this) without masking a genuine
#    failure: if the deploy really failed for another reason, resolving the
#    id right after still fails and the script stops there.
echo "== ensuring the native asset's SAC exists =="
if ! ASSET_DEPLOY_OUT=$(stellar contract asset deploy --asset native \
      --source-account "$PLATFORM_IDENTITY" --network local 2>&1); then
  printf '%s\n' "$ASSET_DEPLOY_OUT" | grep -vi "diagnostic event" >&2
  echo "  (continuing: this is expected once the SAC already exists)"
fi
NATIVE_TOKEN="$(stellar contract id asset --asset native --network local | tail -1 | tr -d '"')"
[ -n "$NATIVE_TOKEN" ] || fail "could not resolve the native asset's contract id"
ok "native SAC: ${NATIVE_TOKEN}"

# 5. Build, only if the vault Wasm is missing. `stellar contract build` (run
#    from CONTRACTS_DIR, same as deploy-local.sh) builds every crate in the
#    workspace, so this one check also produces the factory Wasm.
if [ ! -f "$VAULT_WASM" ]; then
  echo "== vault wasm missing: building the workspace =="
  stellar contract build
fi
[ -f "$VAULT_WASM" ] || fail "expected the vault wasm at $VAULT_WASM and it is not there"
[ -f "$FACTORY_WASM" ] || fail "expected the factory wasm at $FACTORY_WASM and it is not there"

# 6. Upload the vault Wasm to get its hash — the factory deploys vaults by
#    hash, it never embeds the vault's code itself.
echo "== uploading the vault wasm =="
VAULT_WASM_HASH="$(stellar contract upload --wasm "$VAULT_WASM" \
  --source-account "$PLATFORM_IDENTITY" --network local | tail -1 | tr -d '"')"
[ -n "$VAULT_WASM_HASH" ] || fail "uploading the vault wasm did not return a hash"
ok "vault wasm hash: ${VAULT_WASM_HASH}"

# 7. Deploy the factory, owned by the platform's public key (an Address, not
#    a CLI identity name), pointing at the vault's hash.
echo "== deploying the factory =="
FACTORY_ID="$(stellar contract deploy --wasm "$FACTORY_WASM" \
  --source-account "$PLATFORM_IDENTITY" --network local \
  --alias campaign-factory -- \
  --owner="$PLATFORM_PUBLIC_KEY" --vault_wasm="$VAULT_WASM_HASH" | tail -1 | tr -d '"')"
[ -n "$FACTORY_ID" ] || fail "deploying the factory did not return a contract id"
ok "factory: ${FACTORY_ID}"

# 8. Record only public data. Never the secret key.
DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$DEPLOYMENT_FILE" <<JSON
{
  "network": "local",
  "rpcUrl": "${RPC_URL}",
  "horizonUrl": "${HORIZON_URL}",
  "platformPublicKey": "${PLATFORM_PUBLIC_KEY}",
  "tokenContractId": "${NATIVE_TOKEN}",
  "factoryId": "${FACTORY_ID}",
  "vaultWasmHash": "${VAULT_WASM_HASH}",
  "deployedAt": "${DEPLOYED_AT}"
}
JSON

echo
echo "== bootstrap complete =="
echo "  network:            local"
echo "  rpcUrl:              ${RPC_URL}"
echo "  horizonUrl:          ${HORIZON_URL}"
echo "  platformPublicKey:   ${PLATFORM_PUBLIC_KEY}"
echo "  tokenContractId:     ${NATIVE_TOKEN}"
echo "  factoryId:           ${FACTORY_ID}"
echo "  vaultWasmHash:       ${VAULT_WASM_HASH}"
echo "  wrote ${DEPLOYMENT_FILE}"
echo
echo "next: ./scripts/env/generate-docker-env.sh --force (from the repo root)"
