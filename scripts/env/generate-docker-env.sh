#!/usr/bin/env bash
#
# Generate the root `.env.docker` file for the docker environment profile
# (local Supabase + apps/api in a container; see
# docs/architecture/environments.md). It never prints a secret value: only
# the names of the keys it wrote.
#
# Sources:
#   - `supabase status -o env` for the running local Supabase stack
#     (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY).
#   - Fixed, non-secret local defaults (APP_ENV, PORT, LOG_LEVEL,
#     NEXT_PUBLIC_API_BASE_URL).
#   - The `LLM_*` lines, copied verbatim from `.env.cloud` — this profile
#     does not stand up its own LLM credential; it reuses the demo one.
#   - Stellar: `STELLAR_NETWORK=testnet` unless
#     `contracts/.local-deployment.json` exists (written by
#     `contracts/scripts/bootstrap-local-campaign.sh`), in which case the
#     local-network block is written instead, reading the factory/token from
#     that file and the platform secret straight from the Stellar CLI
#     keystore (`stellar keys secret vaqcrow-platform`) — never printed.
#
# Usage:
#   ./scripts/env/generate-docker-env.sh [--force]
#
# --force overwrites an existing .env.docker instead of refusing.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_FILE="${REPO_ROOT}/.env.docker"
CLOUD_FILE="${REPO_ROOT}/.env.cloud"
LOCAL_DEPLOYMENT_FILE="${REPO_ROOT}/contracts/.local-deployment.json"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *)
      echo "usage: $0 [--force]" >&2
      exit 2
      ;;
  esac
done

if [[ -f "$OUT_FILE" && "$FORCE" -ne 1 ]]; then
  echo "refusing to overwrite existing $OUT_FILE (pass --force to regenerate it)" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "the supabase CLI is not on PATH; install it before running this script" >&2
  exit 1
fi

# `supabase status` fails with a clear, non-zero exit when the local API
# container is not up — surface that instead of writing a half-empty file.
if ! SUPABASE_STATUS_ENV="$(supabase status -o env --workdir "$REPO_ROOT" 2>/dev/null)"; then
  echo "supabase local API is not running (supabase status failed)." >&2
  echo "start it first, e.g.: pnpm run env:docker:up" >&2
  exit 1
fi

# `supabase status -o env` prints `KEY="value"` lines (values double-quoted,
# double quotes inside a value backslash-escaped). Parse without eval so a
# value can never be executed as shell.
supabase_field() {
  local key="$1"
  local line value
  line="$(printf '%s\n' "$SUPABASE_STATUS_ENV" | grep -E "^${key}=" | head -n1)"
  [[ -z "$line" ]] && return 1
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value//\\\"/\"}"
  printf '%s' "$value"
}

SUPABASE_URL="$(supabase_field API_URL || true)"
SUPABASE_SERVICE_ROLE_KEY="$(supabase_field SERVICE_ROLE_KEY || true)"
# The CLI moved from JWT-based ANON_KEY to the new PUBLISHABLE_KEY name on
# newer local stacks; accept either so this script keeps working across CLI
# versions.
SUPABASE_PUBLISHABLE_KEY="$(supabase_field PUBLISHABLE_KEY || supabase_field ANON_KEY || true)"

MISSING=()
[[ -z "$SUPABASE_URL" ]] && MISSING+=(SUPABASE_URL)
[[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]] && MISSING+=(SUPABASE_SERVICE_ROLE_KEY)
[[ -z "$SUPABASE_PUBLISHABLE_KEY" ]] && MISSING+=(SUPABASE_PUBLISHABLE_KEY)
if [[ "${#MISSING[@]}" -gt 0 ]]; then
  echo "could not read from \`supabase status -o env\`: ${MISSING[*]}" >&2
  exit 1
fi

if [[ ! -f "$CLOUD_FILE" ]]; then
  echo "$CLOUD_FILE is missing. Create it first from .env.cloud.example (see docs/architecture/environments.md)." >&2
  exit 1
fi

# Never sourced or eval'd: grep the LLM_* assignment lines verbatim so a
# malicious or malformed .env.cloud cannot execute anything here.
LLM_LINES="$(grep -E '^LLM_[A-Z_]+=' "$CLOUD_FILE" || true)"
if [[ -z "$LLM_LINES" ]] || ! printf '%s\n' "$LLM_LINES" | grep -q '^LLM_API_KEY='; then
  echo "$CLOUD_FILE has no LLM_API_KEY line; the docker profile reuses the cloud LLM credential and needs it present." >&2
  exit 1
fi

# Stellar: the local-network profile (docs/architecture/environments.md
# §"Bóveda de campaña en la red local") is opt-in. It only activates once
# `contracts/scripts/bootstrap-local-campaign.sh` (pnpm env:docker:bootstrap)
# has written its public deployment record. Absent that file, the docker
# profile keeps talking to real Testnet — STELLAR_NETWORK=testnet below,
# unchanged from before #237 — with every other Stellar variable left unset
# so the config parser applies its own canonical Testnet defaults.
STELLAR_LINES="STELLAR_NETWORK=testnet"
STELLAR_KEY_NAMES="STELLAR_NETWORK"

if [[ -f "$LOCAL_DEPLOYMENT_FILE" ]]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required to read $LOCAL_DEPLOYMENT_FILE; install it before running this script" >&2
    exit 1
  fi
  if ! command -v stellar >/dev/null 2>&1; then
    echo "the stellar CLI is not on PATH; install it before running this script" >&2
    exit 1
  fi

  json_field() {
    jq -er ".$1" "$LOCAL_DEPLOYMENT_FILE" 2>/dev/null
  }

  LOCAL_HORIZON_URL="$(json_field horizonUrl)" \
    || { echo "$LOCAL_DEPLOYMENT_FILE has no horizonUrl" >&2; exit 1; }
  LOCAL_RPC_URL="$(json_field rpcUrl)" \
    || { echo "$LOCAL_DEPLOYMENT_FILE has no rpcUrl" >&2; exit 1; }
  LOCAL_FACTORY_ID="$(json_field factoryId)" \
    || { echo "$LOCAL_DEPLOYMENT_FILE has no factoryId" >&2; exit 1; }
  LOCAL_TOKEN_CONTRACT_ID="$(json_field tokenContractId)" \
    || { echo "$LOCAL_DEPLOYMENT_FILE has no tokenContractId" >&2; exit 1; }

  # Read straight from the CLI keystore and never echoed — it only ever
  # lands in the file written below (chmod 600).
  if ! LOCAL_PLATFORM_SECRET_KEY="$(stellar keys secret vaqcrow-platform 2>/dev/null)"; then
    echo "could not read the 'vaqcrow-platform' identity's secret key (stellar keys secret vaqcrow-platform)." >&2
    echo "run pnpm env:docker:bootstrap first." >&2
    exit 1
  fi

  # horizonUrl/rpcUrl come from the deployment record rather than being
  # hardcoded here, so a non-default PORT on bootstrap-local-campaign.sh is
  # reflected automatically. Both are host-reachable (bootstrap runs
  # Quickstart bound on the host, same as contracts/scripts/local-network.sh)
  # — docker-compose.local-network.yml is what translates them for the api
  # container (see its header comment).
  STELLAR_LINES="$(cat <<STELLAR
STELLAR_NETWORK=local
STELLAR_HORIZON_URL=${LOCAL_HORIZON_URL}
STELLAR_RPC_URL=${LOCAL_RPC_URL}
STELLAR_CAMPAIGN_FACTORY_ID=${LOCAL_FACTORY_ID}
STELLAR_TOKEN_CONTRACT_ID=${LOCAL_TOKEN_CONTRACT_ID}
STELLAR_PLATFORM_SECRET_KEY=${LOCAL_PLATFORM_SECRET_KEY}
STELLAR
)"
  STELLAR_KEY_NAMES="STELLAR_NETWORK STELLAR_HORIZON_URL STELLAR_RPC_URL STELLAR_CAMPAIGN_FACTORY_ID STELLAR_TOKEN_CONTRACT_ID STELLAR_PLATFORM_SECRET_KEY"
fi

umask 077
{
  echo "# Generated by scripts/env/generate-docker-env.sh — do not edit by hand."
  echo "# Regenerate with: ./scripts/env/generate-docker-env.sh --force"
  echo
  echo "APP_ENV=local"
  echo "PORT=3000"
  echo "LOG_LEVEL=info"
  printf '%s\n' "$STELLAR_LINES"
  echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3000"
  echo
  echo "SUPABASE_URL=${SUPABASE_URL}"
  echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
  echo "SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}"
  echo
  echo "# Copied verbatim from .env.cloud — this profile reuses the demo LLM credential."
  printf '%s\n' "$LLM_LINES"
} > "$OUT_FILE"
chmod 600 "$OUT_FILE"

echo "wrote $OUT_FILE with keys:"
{
  echo "APP_ENV PORT LOG_LEVEL NEXT_PUBLIC_API_BASE_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_PUBLISHABLE_KEY"
  echo "$STELLAR_KEY_NAMES"
  printf '%s\n' "$LLM_LINES" | cut -d= -f1
} | tr '\n' ' ' | tr -s ' '
echo
