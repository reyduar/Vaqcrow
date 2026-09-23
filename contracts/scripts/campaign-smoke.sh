#!/usr/bin/env bash
#
# End-to-end campaign flow on a real network.
#
# Unit tests cannot cover this: the factory deploys by Wasm hash, so the vault's
# Wasm has to be genuinely uploaded before anything can be opened. This script
# runs the whole chain and asserts on what the network reports.
#
# It needs a running network with the `local` alias registered, and a funded
# identity. `local-network.sh start && local-network.sh network-add` followed by
# `stellar keys generate <name> --network local --fund` is enough.
#
# Usage:
#   ./campaign-smoke.sh                    # local, by default
#   NETWORK=testnet ./campaign-smoke.sh
#
set -euo pipefail

NETWORK="${NETWORK:-local}"
SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-vaqcrow-deployer}"
RPC_URL="${RPC_URL:-http://localhost:8000/rpc}"

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$CONTRACTS_DIR"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok()   { echo "  ok  $*"; }

# `stellar contract invoke` prints JSON, so the value comes back quoted.
invoke() {
  local id="$1"; shift
  stellar contract invoke --id "$id" --source-account "$SOURCE_ACCOUNT" --network "$NETWORK" \
    -- "$@" 2>/dev/null | tail -1 | tr -d '"'
}

echo "== build =="
stellar contract build >/dev/null
cargo test --quiet

if ! stellar keys address "$SOURCE_ACCOUNT" >/dev/null 2>&1; then
  echo "== no identity yet: generating and funding $SOURCE_ACCOUNT =="
  stellar keys generate "$SOURCE_ACCOUNT" --network "$NETWORK" --fund
fi

echo "== the native asset's SAC has to exist on every fresh network =="
stellar contract asset deploy --asset native --source-account "$SOURCE_ACCOUNT" \
  --network "$NETWORK" >/dev/null 2>&1 || true
NATIVE=$(stellar contract id asset --asset native --network "$NETWORK" | tail -1 | tr -d '"')
ok "native SAC $NATIVE"

echo "== deploy the factory, pointing at the vault's Wasm =="
VAULT_WASM_HASH=$(stellar contract upload \
  --wasm target/wasm32v1-none/release/campaign_vault.wasm \
  --source-account "$SOURCE_ACCOUNT" --network "$NETWORK" | tail -1 | tr -d '"')
OWNER=$(stellar keys address "$SOURCE_ACCOUNT")
FACTORY=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/campaign_factory.wasm \
  --source-account "$SOURCE_ACCOUNT" --network "$NETWORK" \
  --alias campaign-factory -- \
  --owner="$OWNER" --vault_wasm="$VAULT_WASM_HASH" | tail -1 | tr -d '"')
ok "factory $FACTORY"

# Read the ledger's clock, not the machine's: the contract compares the deadline
# against the ledger time, and the two drift apart while the earlier campaigns
# run. A deadline computed once at the top goes stale and the constructor rejects
# it as already past.
ledger_now() {
  curl -s -X POST "$RPC_URL" -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["latestLedgerCloseTime"])'
}

SME=$(stellar keys address "$SOURCE_ACCOUNT")
GOAL=1000
SALT_A=$(printf 'a1%.0s' {1..32})
SALT_B=$(printf 'b2%.0s' {1..32})
FAR_FUTURE=$(( $(ledger_now) + 86400 ))

echo "== campaign A: the goal is reached =="
VAULT_A=$(invoke "$FACTORY" deploy --salt="$SALT_A" --sme="$SME" --token="$NATIVE" \
  --goal="$GOAL" --deadline="$FAR_FUTURE")
[ "$(invoke "$FACTORY" predict --salt="$SALT_A")" = "$VAULT_A" ] \
  || fail "predict did not match the deployed address"
ok "vault $VAULT_A, and predict agrees"

[ "$(invoke "$VAULT_A" state)" = "0" ] || fail "a fresh campaign should be Funding"
invoke "$VAULT_A" contribute --investor="$SME" --amount=400 >/dev/null
[ "$(invoke "$VAULT_A" total)" = "400" ] || fail "the contribution was not recorded"
[ "$(invoke "$VAULT_A" state)" = "0" ] || fail "400 of 1000 must not settle"
ok "400/1000 leaves it Funding"

invoke "$VAULT_A" contribute --investor="$SME" --amount=600 >/dev/null
[ "$(invoke "$VAULT_A" state)" = "1" ] || fail "reaching the goal must settle"
[ "$(invoke "$VAULT_A" total)" = "1000" ] || fail "total should be 1000"
ok "crossing the goal settled the campaign"

# A settled campaign takes nothing more.
if invoke "$VAULT_A" contribute --investor="$SME" --amount=1 >/dev/null 2>&1; then
  fail "a settled campaign accepted another contribution"
fi
ok "a settled campaign rejects further contributions"

echo "== campaign B: the deadline passes without the goal =="
# Read the clock again here: the campaign opens with a deadline only seconds out,
# so it has to be recent.
VAULT_B=$(invoke "$FACTORY" deploy --salt="$SALT_B" --sme="$SME" --token="$NATIVE" \
  --goal="$GOAL" --deadline=$(( $(ledger_now) + 20 )))
invoke "$VAULT_B" contribute --investor="$SME" --amount=300 >/dev/null
ok "300/1000 contributed"

echo "  waiting for the deadline to pass..."
sleep 30

# Refunding is permissionless: the caller here is not the investor.
[ "$(invoke "$VAULT_B" refund --investor="$SME")" = "300" ] \
  || fail "the refund did not return the contribution"
[ "$(invoke "$VAULT_B" state)" = "2" ] || fail "a deadline without the goal must be Refunding"
ok "the refund returned 300 and moved the campaign to Refunding"

echo
echo "campaign smoke passed on '$NETWORK'"
