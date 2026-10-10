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
