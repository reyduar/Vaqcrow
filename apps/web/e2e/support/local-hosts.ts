/**
 * Loopback classification shared by the E2E external-request guard and its
 * deterministic test (Feature #15 / Task #48).
 *
 * Deliberately free of any `@playwright/test` import: the root test suite
 * (`tests/testing-and-ci-gates.test.ts`) imports this module directly, and
 * `apps/web`'s node_modules are not resolvable from the repository root. Keeping
 * the predicate dependency-free is what makes the "no live external service"
 * boundary testable instead of merely asserted.
 */

/** Hosts that never leave the machine. */
export const LOCAL_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"]);

/** Schemes the browser may use without issuing a network request. */
const NON_NETWORK_PROTOCOLS: ReadonlySet<string> = new Set(["data:", "blob:"]);

/**
 * `true` when a request URL stays on the machine.
 *
 * Hostnames are compared exactly rather than by substring, so `127.0.0.1.evil.com`
 * is rejected — a `startsWith`/`includes` check would have accepted it. WHATWG
 * `URL` keeps the brackets on an IPv6 literal (`[::1]`), so they are stripped
 * before the lookup.
 */
export function isLocalRequest(rawUrl: string): boolean {
  const url = new URL(rawUrl);
  if (NON_NETWORK_PROTOCOLS.has(url.protocol)) return true;
  return LOCAL_HOSTS.has(url.hostname.replace(/^\[|\]$/g, ""));
}
