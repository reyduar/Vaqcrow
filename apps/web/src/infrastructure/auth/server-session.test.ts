// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { readProxySession } from "./server-session";

const ENV = { url: "https://project.supabase.test", publishableKey: "sb_publishable_test" };

interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[], headers?: Record<string, string>): void;
}

function fakeClient({
  claims,
  claimsError = null,
  row = null,
  rowError = null,
  onGetClaims
}: {
  claims?: Record<string, unknown> | null;
  claimsError?: unknown;
  row?: unknown;
  rowError?: unknown;
  onGetClaims?: (cookies: CookieAdapter) => void;
}) {
  const queries: { table: string; columns: string; column: string; value: string }[] = [];
  createServerClient.mockImplementation((_url: string, _key: string, options: { cookies: CookieAdapter }) => ({
    auth: {
      getClaims: vi.fn(async () => {
        onGetClaims?.(options.cookies);
        return { data: claims ? { claims } : null, error: claimsError };
      })
    },
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            queries.push({ table, columns, column, value });
            return { data: row, error: rowError };
          }
        })
      })
    })
  }));
  return queries;
}

const request = () => new NextRequest("https://vaqcrow.test/portfolio", { headers: { cookie: "sb-auth=abc" } });

beforeEach(() => {
  createServerClient.mockReset();
});

describe("readProxySession", () => {
  it("reads the role and name from the user's own profile row, by the verified subject", async () => {
    const queries = fakeClient({
      claims: { sub: "user-1", role: "authenticated", user_metadata: { role: "ADMIN" } },
      row: { role: "INVERSOR", display_name: " Lucía Fernández " }
    });

    const session = await readProxySession(request(), ENV);

    expect(session.principal).toEqual({ role: "INVERSOR", displayName: "Lucía Fernández" });
    expect(queries).toEqual([{ table: "profile", columns: "role, display_name", column: "user_id", value: "user-1" }]);
    expect(createServerClient).toHaveBeenCalledWith(ENV.url, ENV.publishableKey, expect.anything());
  });

  it("passes the request cookies to the client", async () => {
    let seen: { name: string; value: string }[] = [];
    fakeClient({ claims: null, onGetClaims: (cookies) => (seen = cookies.getAll()) });
    await readProxySession(request(), ENV);
    expect(seen).toEqual([{ name: "sb-auth", value: "abc" }]);
  });

  it.each([
    ["no session", { claims: null }],
    ["a claims error", { claims: null, claimsError: new Error("bad jwt") }],
    ["claims without a subject", { claims: { role: "authenticated" } }],
    ["no profile row", { claims: { sub: "user-1" }, row: null }],
    ["a profile read error", { claims: { sub: "user-1" }, rowError: { message: "boom" } }],
    ["an unknown role", { claims: { sub: "user-1" }, row: { role: "ROOT", display_name: "X" } }],
    ["a blank name", { claims: { sub: "user-1" }, row: { role: "PYME", display_name: " " } }]
  ] as const)("is signed out on %s", async (_label, setup) => {
    fakeClient(setup);
    expect((await readProxySession(request(), ENV)).principal).toBeNull();
  });

  it("is signed out when the client throws", async () => {
    createServerClient.mockImplementation(() => {
      throw new Error("network");
    });
    expect((await readProxySession(request(), ENV)).principal).toBeNull();
  });

  it("is signed out without touching Supabase when the configuration is missing", async () => {
    const session = await readProxySession(request(), { url: undefined, publishableKey: "" });
    expect(session.principal).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("copies refreshed session cookies and cache headers onto any response", async () => {
    fakeClient({
      claims: null,
      onGetClaims: (cookies) =>
        cookies.setAll([{ name: "sb-auth", value: "refreshed", options: { path: "/" } }], {
          "cache-control": "private, no-store"
        })
    });
    const session = await readProxySession(request(), ENV);

    const redirect = session.applyTo(NextResponse.redirect(new URL("https://vaqcrow.test/login")));

    expect(redirect.cookies.get("sb-auth")?.value).toBe("refreshed");
    expect(redirect.headers.get("cache-control")).toBe("private, no-store");
  });
});
