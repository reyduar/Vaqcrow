// @vitest-environment node
import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GATED_PATHS } from "@/application/auth/route-gate";
import type { SessionPrincipal } from "@/application/ports/auth-session-port";

const { readProxySession } = vi.hoisted(() => ({ readProxySession: vi.fn() }));
vi.mock("@/infrastructure/auth/server-session", () => ({ readProxySession }));

import { config, proxy } from "./proxy";

function sessionAs(principal: SessionPrincipal | null) {
  const applyTo = vi.fn(<T extends NextResponse>(response: T) => {
    response.headers.set("x-session-applied", "1");
    return response;
  });
  readProxySession.mockResolvedValue({ principal, applyTo });
  return applyTo;
}

const visit = (path: string) => proxy(new NextRequest(`https://vaqcrow.test${path}`));

beforeEach(() => {
  readProxySession.mockReset();
});

describe("proxy", () => {
  it("matches only the gated routes (and their sub-paths)", () => {
    expect([...config.matcher].sort()).toEqual(GATED_PATHS.map((path) => `${path}/:path*`).sort());
  });

  it.each([
    ["/portfolio", null, "/login?role=investor"],
    ["/company", null, "/login?role=pyme"],
    ["/portfolio", { role: "PYME", displayName: "P" }, "/company"],
    ["/company", { role: "INVERSOR", displayName: "I" }, "/portfolio"],
    ["/company", { role: "ADMIN", displayName: "A" }, "/"],
    ["/login", { role: "INVERSOR", displayName: "I" }, "/portfolio"],
    ["/signup", { role: "PYME", displayName: "P" }, "/company"]
  ] as const)("redirects %s for %j to %s, keeping the session cookies", async (path, principal, target) => {
    sessionAs(principal);
    const response = await visit(path);
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.pathname}${location.search}`).toBe(target);
    expect(location.origin).toBe("https://vaqcrow.test");
    expect(response.headers.get("x-session-applied")).toBe("1");
  });

  it.each([
    ["/portfolio", { role: "INVERSOR", displayName: "I" }],
    ["/company", { role: "PYME", displayName: "P" }],
    ["/login", null],
    ["/signup", null]
  ] as const)("lets %s through for %j", async (path, principal) => {
    sessionAs(principal);
    const response = await visit(path);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-session-applied")).toBe("1");
  });

  it("drops the query of the visited page from the redirect", async () => {
    sessionAs(null);
    const response = await visit("/portfolio?role=pyme&x=1");
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.pathname}${location.search}`).toBe("/login?role=investor");
  });
});
