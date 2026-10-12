import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ROUTE_POLICY_KEYS, resolveRoutePolicy } from "../../../application/authorization/route-policy.js";
import { buildOpenApi, toOpenApiPath } from "./build-openapi.js";
import { ROUTE_OPERATIONS } from "./route-registry.js";

/**
 * Issue #487: the API must be documented by a generated OpenAPI 3.1 spec, and a
 * route can never silently go undocumented. These tests are the drift guard:
 * they fail if the registry diverges from the authorization table or if the
 * committed `openapi.json` drifts from the generator.
 */

const SPEC_PATH = fileURLToPath(new URL("../../../../openapi.json", import.meta.url));

function splitKey(key: string): { readonly method: string; readonly pattern: string; readonly path: string } {
  const spaceAt = key.indexOf(" ");
  const method = key.slice(0, spaceAt);
  const pattern = key.slice(spaceAt + 1);
  return { method, pattern, path: toOpenApiPath(pattern).path };
}

describe("OpenAPI spec (#487)", () => {
  it("has exactly one registry entry per authorization-table route", () => {
    expect(Object.keys(ROUTE_OPERATIONS).sort()).toEqual([...ROUTE_POLICY_KEYS].sort());
  });

  it("documents every authorization-table route", () => {
    const document = buildOpenApi();
    for (const key of ROUTE_POLICY_KEYS) {
      const { method, path } = splitKey(key);
      expect(document.paths[path]?.[method.toLowerCase()], `${key} is missing from the spec`).toBeDefined();
    }
  });

  it("derives each operation's security from the route policy", () => {
    const document = buildOpenApi();
    for (const key of ROUTE_POLICY_KEYS) {
      const { method, pattern, path } = splitKey(key);
      const operation = document.paths[path]![method.toLowerCase()] as { readonly security: readonly unknown[] };
      const isPublic = resolveRoutePolicy(method, pattern)?.kind === "public";
      expect(operation.security.length === 0, `${key} security mismatch`).toBe(isPublic);
    }
  });

  it("expresses the auth model as a bearerJWT security scheme", () => {
    const document = buildOpenApi();
    expect(document.openapi).toBe("3.1.0");
    expect(document.info.title).toBeTruthy();
    expect(document.components.securitySchemes["bearerAuth"]).toMatchObject({ type: "http", scheme: "bearer" });
  });

  it("keeps the committed openapi.json in sync with the generator", () => {
    expect(existsSync(SPEC_PATH)).toBe(true);
    const committed = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
    expect(committed).toEqual(buildOpenApi());
  });
});
