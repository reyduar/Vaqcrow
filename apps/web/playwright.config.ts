import { defineConfig } from "@playwright/test";
import { APP_BASE_URL, APP_PORT, STUB_API_BASE_URL } from "./e2e/support/targets";

/**
 * Deterministic browser coverage for the Vaqcrow demo (issue #47).
 *
 * Determinism rules, all deliberate:
 * - Chromium only (deploy-planning.md §Parte 4 decision), single worker, no retries:
 *   a flaky pass is a failure, never something a retry may hide.
 * - The app talks to a local stub API double (`e2e/support/stub-api-server.mjs`) that
 *   serves frozen fixtures. Pull-request verification never reaches Stellar, Horizon,
 *   Supabase, or an LLM provider.
 * - No `webServer` reachability check depends on an external host.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_BASE_URL,
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: [
    {
      name: "stub-api",
      command: "node e2e/support/stub-api-server.mjs",
      url: `${STUB_API_BASE_URL}/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI
    },
    {
      name: "next",
      command: `next dev --hostname 127.0.0.1 --port ${APP_PORT}`,
      url: `${APP_BASE_URL}/request`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { NEXT_PUBLIC_API_BASE_URL: STUB_API_BASE_URL }
    }
  ]
});
