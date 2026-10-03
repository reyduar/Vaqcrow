// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

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

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  createServerClient.mockReset();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
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

  it.each([
    ["the claims read", { hangClaims: true }],
    ["the profile read", { hangProfile: true }]
  ] as const)("fails closed and logs only `timeout` when %s hangs", async (_label, hang) => {
    createServerClient.mockImplementation(() => ({
      auth: {
        getClaims: () => ("hangClaims" in hang ? new Promise(() => {}) : Promise.resolve({ data: { claims: { sub: "u" } }, error: null }))
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => new Promise(() => {}) }) })
      })
    }));

    const session = await readProxySession(request(), ENV, { timeoutMs: 20 });

    expect(session.principal).toBeNull();
    expect(consoleError).toHaveBeenCalledWith("[Proxy] session read failed", { cause: "timeout" });
  });

  it("drops a cookie refresh that lands after the timeout instead of applying it late", async () => {
    let finishClaims!: () => void;
    let cookies!: CookieAdapter;
    createServerClient.mockImplementation((_url: string, _key: string, options: { cookies: CookieAdapter }) => {
      cookies = options.cookies;
      return {
        auth: {
          getClaims: () =>
            new Promise((resolve) => {
              finishClaims = () => {
                cookies.setAll([{ name: "sb-auth", value: "late-refresh", options: { path: "/" } }], {
                  "cache-control": "private, no-store"
                });
                resolve({ data: { claims: { sub: "user-1" } }, error: null });
              };
            })
        },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "INVERSOR", display_name: "I" }, error: null }) }) })
        })
      };
    });
    const req = request();

    const session = await readProxySession(req, ENV, { timeoutMs: 20 });
    finishClaims();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(session.principal).toBeNull();
    expect(req.cookies.get("sb-auth")?.value).toBe("abc");
    const response = session.applyTo(NextResponse.redirect(new URL("https://vaqcrow.test/login")));
    expect(response.cookies.get("sb-auth")).toBeUndefined();
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("keeps a cookie refresh that landed before the timeout", async () => {
    createServerClient.mockImplementation((_url: string, _key: string, options: { cookies: CookieAdapter }) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([{ name: "sb-auth", value: "refreshed", options: { path: "/" } }]);
          return { data: { claims: { sub: "user-1" } }, error: null };
        }
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(() => {}) }) }) })
    }));

    const session = await readProxySession(request(), ENV, { timeoutMs: 20 });

    expect(session.principal).toBeNull();
    const response = session.applyTo(NextResponse.redirect(new URL("https://vaqcrow.test/login")));
    expect(response.cookies.get("sb-auth")?.value).toBe("refreshed");
  });

  it("bounds the session read to 3 seconds by default", async () => {
    vi.useFakeTimers();
    try {
      createServerClient.mockImplementation(() => ({
        auth: { getClaims: () => new Promise(() => {}) },
        from: () => ({})
      }));
      const pending = readProxySession(request(), ENV);
      await vi.advanceTimersByTimeAsync(2999);
      expect(consoleError).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).principal).toBeNull();
      expect(consoleError).toHaveBeenCalledWith("[Proxy] session read failed", { cause: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["a claims error", { claims: null, claimsError: new TypeError("jwt secret-token persona@example.test") }, "TypeError"],
    ["a profile read error", { claims: { sub: "user-1" }, rowError: { message: "persona@example.test", code: "42501" } }, "profile_error"]
  ] as const)("logs only a sanitized cause on %s", async (_label, setup, cause) => {
    fakeClient(setup);
    await readProxySession(request(), ENV);
    expect(consoleError).toHaveBeenCalledWith("[Proxy] session read failed", { cause });
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/secret-token|example\.test|42501/);
  });

  it("logs the error name when the client throws", async () => {
    createServerClient.mockImplementation(() => {
      throw new RangeError("network persona@example.test");
    });
    await readProxySession(request(), ENV);
    expect(consoleError).toHaveBeenCalledWith("[Proxy] session read failed", { cause: "RangeError" });
  });

  it("does not log an ordinary signed-out visit", async () => {
    fakeClient({ claims: null });
    await readProxySession(request(), ENV);
    expect(consoleError).not.toHaveBeenCalled();
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
