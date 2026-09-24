import { randomUUID } from "node:crypto";
import { LIVE_API_BASE_URL, LIVE_RPC_URL } from "./live-targets";

/**
 * Fails fast, with a clear message, when the docker-profile API or the
 * Stellar Quickstart local network are not actually up — instead of letting
 * every test in the suite time out separately against a webServer that never
 * serves anything meaningful. Never starts or stops anything itself (the
 * task's own hard rule): this is a readiness probe, not orchestration.
 */
const SETUP_HINT =
  "Bring up the local chain profile first (docs/architecture/environments.md §11):\n" +
  "  pnpm env:docker:bootstrap\n" +
  "  ./scripts/env/generate-docker-env.sh --force\n" +
  "  pnpm env:docker:up";

async function checkApiHealth(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${LIVE_API_BASE_URL}/health`);
  } catch (caught) {
    throw new Error(
      `Could not reach the API at ${LIVE_API_BASE_URL}/health (${String(caught)}).\n${SETUP_HINT}`
    );
  }
  if (!response.ok) {
    throw new Error(`API health check returned ${String(response.status)} at ${LIVE_API_BASE_URL}/health.\n${SETUP_HINT}`);
  }
}

async function checkSorobanRpcHealth(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(LIVE_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" })
    });
  } catch (caught) {
    throw new Error(`Could not reach the Soroban RPC at ${LIVE_RPC_URL} (${String(caught)}).\n${SETUP_HINT}`);
  }
  if (!response.ok) {
    throw new Error(`Soroban RPC returned ${String(response.status)} at ${LIVE_RPC_URL}.\n${SETUP_HINT}`);
  }
  const body = (await response.json()) as { result?: { status?: string } };
  if (body.result?.status !== "healthy") {
    throw new Error(`Soroban RPC reports "${String(body.result?.status)}", not "healthy", at ${LIVE_RPC_URL}.\n${SETUP_HINT}`);
  }
}

/**
 * Confirms the campaign-vault routes are actually wired (not just that some
 * server answers on port 3000): a random, never-seeded campaign id must come
 * back `404 not_found`, not a connection error or an unrelated 5xx.
 */
async function checkCampaignRoutesAvailable(): Promise<void> {
  const probeId = randomUUID();
  let response: Response;
  try {
    response = await fetch(`${LIVE_API_BASE_URL}/campaigns/${probeId}`);
  } catch (caught) {
    throw new Error(`Could not reach ${LIVE_API_BASE_URL}/campaigns/:id (${String(caught)}).\n${SETUP_HINT}`);
  }
  if (response.status !== 404) {
    throw new Error(
      `Expected 404 from an unseeded campaign id at ${LIVE_API_BASE_URL}/campaigns/${probeId}, got ${String(response.status)}. ` +
        "Is the API container actually running the docker profile against the local network?\n" +
        SETUP_HINT
    );
  }
}

export default async function globalSetup(): Promise<void> {
  await checkApiHealth();
  await checkSorobanRpcHealth();
  await checkCampaignRoutesAvailable();
}
