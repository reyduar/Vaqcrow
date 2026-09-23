#!/usr/bin/env bash
#
# Start or stop a local Stellar network in Docker, and register it with the
# Stellar CLI.
#
# The local network is the development and CI lane: it never resets, deploys
# instantly and is deterministic. It does NOT replace Testnet for the demo
# evidence, because it is not public and no third party can verify it.
#
# Usage:
#   ./local-network.sh start         # start it and wait until it is healthy
#   ./local-network.sh stop          # remove the container
#   ./local-network.sh network-add   # register it as the `local` CLI network
#
set -euo pipefail

CONTAINER="${CONTAINER:-vaqcrow-local}"
IMAGE="${IMAGE:-stellar/quickstart:testing}"
PORT="${PORT:-8000}"
PASSPHRASE="Standalone Network ; February 2017"

start() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

  # `--local` on its own is enough: it brings up core, Horizon, Stellar RPC and
  # Friendbot, and applies Testnet's resource limits.
  #
  # Do NOT pass `--enable-stellar-rpc`. The official docs suggest it and this
  # image rejects it outright with `Unknown container arg --enable-stellar-rpc`,
  # exiting with status 1 before anything starts.
  docker run -d -p "${PORT}:8000" --name "$CONTAINER" "$IMAGE" --local >/dev/null

  echo "waiting for the local network on http://localhost:${PORT} ..."
  for _ in $(seq 1 60); do
    if curl -s -X POST "http://localhost:${PORT}/rpc" \
        -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' --max-time 3 \
        | grep -q '"status":"healthy"'; then
      echo "healthy"
      return 0
    fi
    sleep 3
  done

  echo "the local network never became healthy. Last logs:" >&2
  docker logs --tail 40 "$CONTAINER" >&2
  return 1
}

stop() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  echo "stopped"
}

network_add() {
  stellar network add local \
    --rpc-url "http://localhost:${PORT}/rpc" \
    --network-passphrase "$PASSPHRASE"
  echo "registered the \`local\` network"
}

case "${1:-start}" in
  start)       start ;;
  stop)        stop ;;
  network-add) network_add ;;
  *)
    echo "usage: $0 {start|stop|network-add}" >&2
    exit 2
    ;;
esac
