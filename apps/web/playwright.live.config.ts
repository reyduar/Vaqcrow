import { defineConfig } from "@playwright/test";
import { LIVE_API_BASE_URL, LIVE_APP_BASE_URL, LIVE_APP_PORT } from "./e2e-live/support/live-targets";

/**
 * Opt-in live journey for the campaign vault (Task #248, T4). Drives the
 * real funding page against the docker-profile API (`STELLAR_NETWORK=local`)
 * and the Stellar Quickstart local network — real Horizon, real Soroban RPC,
 * real Supabase-local rows, no stub and no fixtures. This is the deliberate
 * opt-in counterpart to `playwright.config.ts`'s deterministic, stub-backed
 * suite (D1, `odd/tasks/campaign-vault-web-tests.md`).
 *
 * Never part of `pnpm run test:e2e`, `pnpm run verify`, or CI (see
 * `docs/architecture/environments.md`'s new subsection): run explicitly,
 * once the local chain profile is up, with
 * `pnpm --filter @vaqcrow/web run test:e2e:live` (or the root alias
 * `pnpm run test:e2e:live`). `e2e-live/support/global-setup.ts` fails fast
 * with setup instructions if that profile is not actually reachable.
 *
 * Timeouts are generous on purpose: a real vault deployment and a real
 * on-chain settlement each cost multiple ledger closes (~5s apiece) against
 * a local network, not a synchronous stub double.
 */
export default defineConfig({
  testDir: "./e2e-live",
  globalSetup: "./e2e-live/support/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: LIVE_APP_BASE_URL,
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    name: "next-live",
    command: `next dev --hostname 127.0.0.1 --port ${LIVE_APP_PORT}`,
    url: `${LIVE_APP_BASE_URL}/funding`,
    timeout: 120_000,
    // Always reuse: this suite never runs in CI, and a dev already running
    // this same server (e.g. `pnpm dev:web:docker`) should not be killed and
    // restarted by a test run.
    reuseExistingServer: true,
    env: { NEXT_PUBLIC_API_BASE_URL: LIVE_API_BASE_URL }
  }
});
