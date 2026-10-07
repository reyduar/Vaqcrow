#!/usr/bin/env bash
#
# End-to-end campaign flow on a real network.
#
# Unit tests cannot cover this: the factory deploys by Wasm hash, so the vault's
# Wasm has to be genuinely uploaded before anything can be opened. This script
# runs the whole chain and asserts on what the network reports.
#
# It needs a running network with the `local` alias registered. The deployer and
# every investor identity are generated and funded on first run, so
# `local-network.sh start && local-network.sh network-add` is enough.
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

# `stellar contract invoke` prints the value as JSON, so it comes back quoted.
# Diagnostic events also land on stdout, so only the last line is the value.
#
# Errors are NOT swallowed. An earlier version sent stderr to /dev/null and a
# failure in the middle of the run showed up as nothing at all — which cost real
# debugging time and is the worst possible failure mode for a test script.
#
# The signing account is explicit: `contribute` is authenticated by the investor,
# so it has to be signed by that investor's own key, not by the deployer. Reads,
# deploys and the permissionless refund stay on the default account.
invoke_as() {
  local account="$1"; shift
  local id="$1"; shift
  local out
  if ! out=$(stellar contract invoke --id "$id" --source-account "$account" \
        --network "$NETWORK" -- "$@" 2>&1); then
    echo "  invoke failed as '$account': $*" >&2
    printf '%s\n' "$out" | grep -vi "diagnostic event" >&2
    return 1
  fi
  printf '%s\n' "$out" | tail -1 | tr -d '"'
}

invoke() { invoke_as "$SOURCE_ACCOUNT" "$@"; }

# Generate and fund a key only when it does not exist yet, so a re-run on a
# persistent local network reuses the identities instead of failing. Funding
# comes from the network's own Friendbot, so this adds no external dependency.
ensure_identity() {
  local name="$1"
  if ! stellar keys address "$name" >/dev/null 2>&1; then
    echo "== no identity yet: generating and funding $name =="
    stellar keys generate "$name" --network "$NETWORK" --fund
  fi
}

echo "== build =="
stellar contract build >/dev/null
cargo test --quiet

ensure_identity "$SOURCE_ACCOUNT"

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
# The vault refuses any contribution above a tenth of the goal, so reaching it
# takes at least ten distinct investors. Ten investors of CAP_A add up to exactly
# GOAL: the campaign must stay Funding through the ninth and settle on the tenth.
CAP_A=$(( GOAL / 10 ))
SALT_A=$(printf 'a1%.0s' {1..32})
SALT_B=$(printf 'b2%.0s' {1..32})
FAR_FUTURE=$(( $(ledger_now) + 86400 ))

echo "== the investor identities ($CAP_A each) =="
INVESTORS=()
for n in $(seq 1 10); do
  name=$(printf 'vaqcrow-investor-%02d' "$n")
  ensure_identity "$name"
  INVESTORS+=("$name")
done
INVESTOR_01="${INVESTORS[0]}"
INVESTOR_01_ADDR=$(stellar keys address "$INVESTOR_01")
ok "${#INVESTORS[@]} distinct investors, each funded"

echo "== campaign A: the goal is reached =="
VAULT_A=$(invoke "$FACTORY" deploy --salt="$SALT_A" --sme="$SME" --token="$NATIVE" \
  --goal="$GOAL" --deadline="$FAR_FUTURE")
[ "$(invoke "$FACTORY" predict --salt="$SALT_A")" = "$VAULT_A" ] \
  || fail "predict did not match the deployed address"
ok "vault $VAULT_A, and predict agrees"

[ "$(invoke "$VAULT_A" state)" = "0" ] || fail "a fresh campaign should be Funding"

# Assert the cap itself, while the campaign is still Funding. Investor 01 accepts
# its full tenth first, then a second contribution of the same size is refused.
# Because the first one moved real tokens, the refusal cannot be a balance
# problem — the only thing that changed is that the investor is now at goal/10.
invoke_as "$INVESTOR_01" "$VAULT_A" contribute \
  --investor="$INVESTOR_01_ADDR" --amount="$CAP_A" >/dev/null
[ "$(invoke "$VAULT_A" total)" = "$CAP_A" ] || fail "the capped contribution was not recorded"
if cap_out=$(invoke_as "$INVESTOR_01" "$VAULT_A" contribute \
      --investor="$INVESTOR_01_ADDR" --amount="$CAP_A" 2>&1); then
  fail "a second $CAP_A contribution from a capped investor was accepted"
fi
printf '%s\n' "$cap_out" | grep -q '#10' \
  || fail "the over-cap contribution failed for the wrong reason: $cap_out"
[ "$(invoke "$VAULT_A" total)" = "$CAP_A" ] || fail "the refused contribution moved the total"
ok "a capped investor cannot contribute past goal/10"

# Eight more distinct investors, then the tenth settles. That is nine capped
# contributions in total (investor 01 plus these eight): 900 of 1000, still Funding.
for name in "${INVESTORS[@]:1:8}"; do
  addr=$(stellar keys address "$name")
  invoke_as "$name" "$VAULT_A" contribute --investor="$addr" --amount="$CAP_A" >/dev/null
done
[ "$(invoke "$VAULT_A" total)" = "$(( 9 * CAP_A ))" ] \
  || fail "nine capped contributions should total $(( 9 * CAP_A ))"
[ "$(invoke "$VAULT_A" state)" = "0" ] || fail "$(( 9 * CAP_A )) of $GOAL must not settle"
ok "9 x $CAP_A = $(( 9 * CAP_A )) leaves it Funding"

LAST="${INVESTORS[9]}"
invoke_as "$LAST" "$VAULT_A" contribute \
  --investor="$(stellar keys address "$LAST")" --amount="$CAP_A" >/dev/null
[ "$(invoke "$VAULT_A" state)" = "1" ] || fail "reaching the goal must settle"
[ "$(invoke "$VAULT_A" total)" = "$GOAL" ] || fail "total should be $GOAL"
ok "the tenth contribution settled the campaign at $GOAL"

# A settled campaign takes nothing more.
if invoke "$VAULT_A" contribute --investor="$SME" --amount=1 >/dev/null 2>&1; then
  fail "a settled campaign accepted another contribution"
fi
ok "a settled campaign rejects further contributions"

echo "== campaign B: the deadline passes without the goal =="
# Read the clock again here, and leave a wide margin. The campaign opens with a
# deadline only seconds out, so it has to be recent — and a 20-second margin
# turned out to be marginal against Testnet's latency, where the transaction can
# land a couple of ledgers after it was built.
#
# campaign B uses its own goal so the contribution stays inside the cap: goal/10
# is 300, and the single investor contributes exactly that. It never reaches the
# goal, so the deadline path — not settlement — decides the outcome.
GOAL_B=3000
CAP_B=$(( GOAL_B / 10 ))
INVESTOR_B=vaqcrow-investor-b
ensure_identity "$INVESTOR_B"
INVESTOR_B_ADDR=$(stellar keys address "$INVESTOR_B")
VAULT_B=$(invoke "$FACTORY" deploy --salt="$SALT_B" --sme="$SME" --token="$NATIVE" \
  --goal="$GOAL_B" --deadline=$(( $(ledger_now) + 45 )))
invoke_as "$INVESTOR_B" "$VAULT_B" contribute \
  --investor="$INVESTOR_B_ADDR" --amount="$CAP_B" >/dev/null
ok "$CAP_B/$GOAL_B contributed (within goal/10)"

echo "  waiting for the deadline to pass..."
sleep 60

# Refunding is permissionless: the caller here is not the investor.
[ "$(invoke "$VAULT_B" refund --investor="$INVESTOR_B_ADDR")" = "$CAP_B" ] \
  || fail "the refund did not return the contribution"
[ "$(invoke "$VAULT_B" state)" = "2" ] || fail "a deadline without the goal must be Refunding"
ok "the refund returned $CAP_B and moved the campaign to Refunding"

echo
echo "campaign smoke passed on '$NETWORK'"
