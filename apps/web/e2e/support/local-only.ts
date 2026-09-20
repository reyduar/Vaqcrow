import { expect, test as base } from "@playwright/test";

/**
 * Makes "pull-request verification never touches a live external service" an
 * executable assertion instead of prose: every test built on this `test` fails if
 * the browser requests any host other than the app or the local stub double.
 *
 * A regression that reaches Stellar, Horizon, Supabase, or an LLM provider during
 * E2E therefore fails the suite, not just a code review.
 */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export const test = base.extend<{ externalRequestGuard: void }>({
  externalRequestGuard: [
    async ({ page }, use) => {
      const external: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.protocol === "data:" || url.protocol === "blob:") return;
        if (!LOCAL_HOSTS.has(url.hostname)) external.push(request.url());
      });

      await use();

      expect(external, `E2E must not reach external hosts: ${external.join(", ")}`).toEqual([]);
    },
    { auto: true }
  ]
});

export { expect };
