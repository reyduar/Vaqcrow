import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseHealthProbe } from "./supabase-health-probe.js";

/** A stand-in client whose read resolves as configured, or throws. */
function clientWithSelect(select: () => Promise<{ error: unknown }>): SupabaseClient {
  return { from: () => ({ select }) } as unknown as SupabaseClient;
}

describe("SupabaseHealthProbe", () => {
  it("returns ok when the read-only query succeeds", async () => {
    const probe = new SupabaseHealthProbe(clientWithSelect(async () => ({ error: null })));

    await expect(probe.check()).resolves.toBe("ok");
  });

  it("returns unavailable when PostgREST reports an error", async () => {
    const probe = new SupabaseHealthProbe(
      clientWithSelect(async () => ({
        error: { message: "permission denied", code: "42501", details: "d", hint: "h" }
      }))
    );

    await expect(probe.check()).resolves.toBe("unavailable");
  });

  it("returns unavailable when the client throws instead of resolving", async () => {
    const probe = new SupabaseHealthProbe(
      clientWithSelect(async () => {
        throw new Error("network unreachable");
      })
    );

    await expect(probe.check()).resolves.toBe("unavailable");
  });
});
