import type { FastifyInstance } from "fastify";

/** One dependency's liveness, as reported by `/health`. */
export type DependencyStatus = "ok" | "unavailable";

/** The body `/health` answers with once a dependency report is wired. */
export interface HealthReport {
  readonly status: "ok" | "degraded";
  readonly dependencies: Readonly<Record<string, DependencyStatus>>;
}

/**
 * The route's dependency seam: a named set of cheap probes. Each probe resolves
 * `"ok"` or `"unavailable"`; the route never trusts a probe to stay well-behaved.
 */
export interface HealthRouteDependencies {
  readonly probes: Readonly<Record<string, () => Promise<DependencyStatus>>>;
}

/**
 * `GET /health` — public, and registered unconditionally because `railway.json`
 * uses it as the deploy healthcheck.
 *
 * With no dependencies it answers exactly `{ status: "ok" }`, unchanged from
 * before a report existed. With probes it runs them all and answers
 * `{ status, dependencies }` — but always **HTTP 200**, even when a probe is
 * unavailable or throws (owner decision D1, 2026-10-11): the healthcheck pairs
 * with `restartPolicyType: ON_FAILURE`, so a transient Supabase blip must show
 * up as `degraded`, not cycle the container. A throwing probe is folded to
 * `"unavailable"` rather than escaping as a 5xx.
 */
export function registerHealthRoute(app: FastifyInstance, dependencies?: HealthRouteDependencies): void {
  app.get("/health", async () => {
    if (dependencies === undefined) {
      return { status: "ok" };
    }

    // `probes` is required by the type; the fallback only guards an untyped
    // caller, and it keeps the always-200 guarantee even out of contract.
    const entries = Object.entries(dependencies.probes ?? {});
    const results = await Promise.all(
      entries.map(async ([name, probe]) => {
        try {
          return [name, await probe()] as const;
        } catch {
          return [name, "unavailable"] as const;
        }
      })
    );

    const report: Record<string, DependencyStatus> = {};
    for (const [name, status] of results) {
      report[name] = status;
    }

    const status: HealthReport["status"] = results.every(([, value]) => value === "ok") ? "ok" : "degraded";
    const body: HealthReport = { status, dependencies: report };
    return body;
  });
}
