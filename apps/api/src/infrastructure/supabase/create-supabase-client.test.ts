import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSupabaseConfig } from "../../application/config/supabase-config.js";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args)
}));

/** Synthetic fixtures. Not credentials, not a reachable project. */
const VALID_ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key"
};

describe("createSupabaseClient", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("refuses to build a client from an environment missing a required key", async () => {
    const { createSupabaseClient } = await import("./create-supabase-client.js");

    // Validation lives in `application/config`, so the adapter is only ever
    // handed a configuration that already passed the boundary.
    expect(() => createSupabaseClient(parseSupabaseConfig({}))).toThrow(/SUPABASE_URL/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("builds the client from the parsed configuration, revealing the secret only here", async () => {
    const sentinelClient = { from: vi.fn() } as unknown as SupabaseClient;
    createClientMock.mockReturnValueOnce(sentinelClient);
    const { createSupabaseClient } = await import("./create-supabase-client.js");

    const config = parseSupabaseConfig(VALID_ENV);

    // The key crosses the boundary wrapped: serialising the config cannot leak it.
    expect(JSON.stringify(config)).not.toContain("service-role-key");

    const client = createSupabaseClient(config);

    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) })
    );
    expect(client).toBe(sentinelClient);
  });
});

describe("createPublishableSupabaseClient", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("throws when the publishable key is absent from the configuration", async () => {
    const { createPublishableSupabaseClient } = await import("./create-supabase-client.js");

    const config = parseSupabaseConfig({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    });

    expect(config.publishableKey).toBeUndefined();
    expect(() => createPublishableSupabaseClient(config)).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("builds the client from the parsed configuration", async () => {
    const sentinelClient = { from: vi.fn() } as unknown as SupabaseClient;
    createClientMock.mockReturnValueOnce(sentinelClient);
    const { createPublishableSupabaseClient } = await import("./create-supabase-client.js");

    const client = createPublishableSupabaseClient(parseSupabaseConfig(VALID_ENV));

    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "publishable-key",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) })
    );
    expect(client).toBe(sentinelClient);
  });
});
