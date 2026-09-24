/**
 * Loopback targets for the opt-in live journey (Task #248, T4).
 *
 * Deliberately distinct from `../../e2e/support/targets.ts`'s ports: this
 * suite drives a *second*, independently started `next dev` (this one talks
 * to the real docker-profile API, not the deterministic stub double), so it
 * must never collide with a PR-gated E2E run on the same machine.
 *
 * The Next.js port and the API/Horizon/RPC hosts match
 * `docs/architecture/environments.md` §11 and the docker profile's own
 * `CORS_ALLOWED_ORIGINS` default for `STELLAR_NETWORK=local`
 * (`apps/api/src/application/config/cors-config.ts`).
 */

export const LIVE_APP_PORT = 3001;
export const LIVE_APP_BASE_URL = `http://127.0.0.1:${LIVE_APP_PORT}`;

/** The docker-profile API container (Task prompt: "already running", `STELLAR_NETWORK=local`). */
export const LIVE_API_BASE_URL = "http://localhost:3000";

/** Stellar Quickstart, local network (Horizon at `/`, Soroban RPC at `/rpc`, Friendbot at `/friendbot`). */
export const LIVE_HORIZON_URL = "http://localhost:8000";
export const LIVE_RPC_URL = "http://localhost:8000/rpc";
export const LIVE_FRIENDBOT_URL = "http://localhost:8000/friendbot";

/** `contracts/scripts/local-network.sh`'s own Quickstart passphrase. */
export const LIVE_NETWORK_PASSPHRASE = "Standalone Network ; February 2017";

/** The Supabase local database container (`docker exec -i <name> psql …`, `CLAUDE.md`). */
export const LIVE_DB_CONTAINER = "supabase_db_vaqcrow";

/** One stroop, as a bigint multiplier — 1 XLM = 10_000_000 stroops. */
export const STROOPS_PER_XLM = 10_000_000n;

export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * Number(STROOPS_PER_XLM)));
}

/**
 * `apps/web/src/application/fixtures/demo-application.ts`'s fixed id,
 * duplicated literally — `e2e-live/` must not import from `src/`, the same
 * "cross-boundary fixture literals are duplicated on purpose" convention
 * `apps/web/e2e/support/targets.ts` already documents. The real `/funding`
 * route never overrides `CampaignWorkspace`'s `applicationId` prop
 * (`apps/web/src/app/(demo)/funding/page.tsx`), so this is the *only*
 * application id the real "Abrir bóveda" form can ever open a vault for —
 * and therefore, on this local database, the only application that can ever
 * have more than one campaign-open attempt resolve to the *same* campaign
 * (idempotent replay, `openCampaign`'s own `findByApplicationId` check).
 */
export const DEMO_APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
