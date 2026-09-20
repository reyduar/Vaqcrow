import { expect, test as base } from "@playwright/test";
import { isLocalRequest } from "./local-hosts";

/**
 * Makes "pull-request verification never touches a live external service" an
 * executable assertion instead of prose: every test built on this `test` fails if
 * the browser requests any host other than the app or the local stub double.
 *
 * A regression that reaches Stellar, Horizon, Supabase, or an LLM provider during
 * E2E therefore fails the suite, not just a code review.
 *
 * The predicate itself lives in `./local-hosts.ts` (no Playwright import) so the
 * root test suite can exercise its rejection path directly — see issue #48.
 */
export const test = base.extend<{ externalRequestGuard: void }>({
  externalRequestGuard: [
    async ({ page }, use) => {
      const external: string[] = [];
      page.on("request", (request) => {
        if (!isLocalRequest(request.url())) external.push(request.url());
      });

      await use();

      expect(external, `E2E must not reach external hosts: ${external.join(", ")}`).toEqual([]);
    },
    { auto: true }
  ]
});

export { expect };

