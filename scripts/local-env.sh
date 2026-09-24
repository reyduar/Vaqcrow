#!/usr/bin/env bash
#
# Drive the docker environment profile: local Supabase (CLI-managed
# containers), the Stellar Quickstart network, and apps/api built and run
# from docker-compose.local.yml. See docs/architecture/environments.md.
#
# Usage:
#   ./scripts/local-env.sh up|down|status|bootstrap [--all]
#
#   bootstrap  deploy the campaign vault (factory + native SAC) on the
#              Stellar local network — thin wrapper around
#              contracts/scripts/bootstrap-local-campaign.sh. Run this BEFORE
#              `up` (or before regenerating .env.docker) to opt the docker
#              profile into the local-network Stellar block instead of
#              Testnet; see docs/architecture/environments.md §"Bóveda de
#              campaña en la red local" for the full command order.
#   up         start Supabase, the Quickstart network (if not already
#              healthy), generate .env.docker if missing, then build and
#              start the api container.
#   down       stop the api container and the local Supabase stack. With
#              --all, also stop the Stellar Quickstart network.
#   status     print the state of every piece without starting anything.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.local.yml"
LOCAL_NETWORK_COMPOSE_FILE="${REPO_ROOT}/docker-compose.local-network.yml"
ENV_FILE="${REPO_ROOT}/.env.docker"
BOOTSTRAP_SCRIPT="${REPO_ROOT}/contracts/scripts/bootstrap-local-campaign.sh"
QUICKSTART_SCRIPT="${REPO_ROOT}/contracts/scripts/local-network.sh"
QUICKSTART_PORT="${QUICKSTART_PORT:-8000}"
API_HEALTH_URL="http://localhost:3000/health"
API_WAIT_SECONDS="${API_WAIT_SECONDS:-60}"

# Containers this profile does not need: the API only talks to kong (the
# gateway behind SUPABASE_URL) and postgrest (SUPABASE_SERVICE_ROLE_KEY
# reads/writes through it). Everything below is either UI-only (studio),
# unused by the demo (storage-api and its imgproxy dependent, realtime,
# edge-runtime, supavisor pooling), or log/mail infra with no consumer here
# (logflare, vector, mailpit — mailpit replaced the older `inbucket` name in
# supabase CLI 2.x, confirmed against `supabase start --help`).
SUPABASE_EXCLUDE="studio,imgproxy,edge-runtime,logflare,vector,mailpit,realtime,storage-api,supavisor"

require_docker() {
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not reachable (is Docker Desktop running?)" >&2
    exit 1
  fi
}

quickstart_healthy() {
  curl -s -X POST "http://localhost:${QUICKSTART_PORT}/rpc" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' --max-time 3 2>/dev/null \
    | grep -q '"status":"healthy"'
}

# Any HTTP answer from kong counts: without an apikey it replies 401, which
# still proves the gateway is serving.
supabase_gateway_up() {
  curl -s -o /dev/null --max-time 3 "http://127.0.0.1:54321/rest/v1/" 2>/dev/null
}

api_healthy() {
  curl -sf --max-time 3 "$API_HEALTH_URL" >/dev/null 2>&1
}

# Only merges docker-compose.local-network.yml when .env.docker itself was
# generated for the Stellar local-network profile — see that file's header
# comment for why it is unsafe to merge unconditionally.
compose_args() {
  COMPOSE_ARGS=(-f "$COMPOSE_FILE")
  if [[ -f "$ENV_FILE" ]] && grep -qx 'STELLAR_NETWORK=local' "$ENV_FILE"; then
    COMPOSE_ARGS+=(-f "$LOCAL_NETWORK_COMPOSE_FILE")
  fi
}

bootstrap() {
  "$BOOTSTRAP_SCRIPT" "$@"
}

up() {
  require_docker

  echo "== starting local Supabase (excluding: ${SUPABASE_EXCLUDE}) =="
  supabase start --workdir "$REPO_ROOT" -x "$SUPABASE_EXCLUDE"

  # `supabase start` treats the stack as running as soon as the db container
  # is up, even when kong/postgrest are stopped (e.g. after the db was started
  # on its own). The API needs the gateway, so restart a partial stack.
  # `supabase stop` keeps the data volume; only `--no-backup` would drop it.
  if ! supabase_gateway_up; then
    echo "== local Supabase is only partially running (no gateway on :54321); restarting it =="
    supabase stop --workdir "$REPO_ROOT"
    supabase start --workdir "$REPO_ROOT" -x "$SUPABASE_EXCLUDE"
    if ! supabase_gateway_up; then
      echo "the Supabase gateway on :54321 is still unreachable after a restart" >&2
      exit 1
    fi
  fi

  if quickstart_healthy; then
    echo "== Stellar Quickstart already healthy on :${QUICKSTART_PORT}, leaving it as-is =="
  else
    echo "== starting Stellar Quickstart =="
    "$QUICKSTART_SCRIPT" start
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    echo "== .env.docker missing, generating it =="
    "${REPO_ROOT}/scripts/env/generate-docker-env.sh"
  else
    echo "== .env.docker already present, reusing it (pass --force to scripts/env/generate-docker-env.sh to regenerate) =="
  fi

  compose_args
  echo "== building and starting the api container =="
  docker compose "${COMPOSE_ARGS[@]}" up -d --build

  echo "== waiting up to ${API_WAIT_SECONDS}s for ${API_HEALTH_URL} =="
  local waited=0
  until api_healthy; do
    if [[ "$waited" -ge "$API_WAIT_SECONDS" ]]; then
      echo "api never became healthy within ${API_WAIT_SECONDS}s. Last logs:" >&2
      docker compose "${COMPOSE_ARGS[@]}" logs --tail 60 api >&2
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo "api is healthy at ${API_HEALTH_URL}"
}

down() {
  local all=0
  for arg in "$@"; do
    [[ "$arg" == "--all" ]] && all=1
  done

  compose_args
  echo "== stopping the api container =="
  docker compose "${COMPOSE_ARGS[@]}" down

  echo "== stopping local Supabase =="
  supabase stop --workdir "$REPO_ROOT"

  if [[ "$all" -eq 1 ]]; then
    echo "== stopping Stellar Quickstart (--all) =="
    "$QUICKSTART_SCRIPT" stop
  fi
}

status() {
  compose_args
  echo "== api container (docker compose ps) =="
  docker compose "${COMPOSE_ARGS[@]}" ps || true

  echo
  echo "== local Supabase (service names and URLs only, no keys) =="
  if command -v jq >/dev/null 2>&1; then
    supabase status --workdir "$REPO_ROOT" -o json 2>/dev/null \
      | jq 'with_entries(select(.key | test("KEY|SECRET|JWT"; "i") | not))' \
      || echo "supabase status unavailable (stack likely stopped)"
  else
    # No jq: fall back to the CLI's own pretty table, which does not print
    # key values by default (only -o env / -o json do).
    supabase status --workdir "$REPO_ROOT" 2>/dev/null \
      || echo "supabase status unavailable (stack likely stopped)"
  fi

  echo
  echo "== Stellar Quickstart (:${QUICKSTART_PORT}) =="
  if quickstart_healthy; then
    echo "healthy"
  else
    echo "not running or not healthy"
  fi

  echo
  echo "== api health (${API_HEALTH_URL}) =="
  if api_healthy; then
    echo "healthy"
  else
    echo "not running or not healthy"
  fi

  echo
  echo "== Stellar profile (.env.docker) =="
  if [[ -f "$ENV_FILE" ]] && grep -qx 'STELLAR_NETWORK=local' "$ENV_FILE"; then
    echo "local (docker-compose.local-network.yml merged)"
  elif [[ -f "$ENV_FILE" ]]; then
    echo "testnet"
  else
    echo "unknown (.env.docker not generated yet)"
  fi
}

case "${1:-}" in
  up)        up ;;
  down)      shift; down "$@" ;;
  status)    status ;;
  bootstrap) shift; bootstrap "$@" ;;
  *)
    echo "usage: $0 {up|down|status|bootstrap} [--all]" >&2
    exit 2
    ;;
esac
