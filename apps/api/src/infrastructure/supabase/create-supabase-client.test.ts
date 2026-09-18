import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args)
}));

describe("createSupabaseClient", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("throws when SUPABASE_URL is missing", async () => {
    const { createSupabaseClient } = await import("./create-supabase-client.js");

    expect(() =>
      createSupabaseClient({ SUPABASE_SERVICE_ROLE_KEY: "service-role-key" })
    ).toThrow(/SUPABASE_URL/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    const { createSupabaseClient } = await import("./create-supabase-client.js");

    expect(() => createSupabaseClient({ SUPABASE_URL: "https://project.supabase.co" })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("builds the Supabase client from the provided URL and service role key", async () => {
    const sentinelClient = { from: vi.fn() } as unknown as SupabaseClient;
    createClientMock.mockReturnValueOnce(sentinelClient);
    const { createSupabaseClient } = await import("./create-supabase-client.js");

    const client = createSupabaseClient({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    });

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

  it("throws when SUPABASE_URL is missing", async () => {
    const { createPublishableSupabaseClient } = await import("./create-supabase-client.js");

    expect(() =>
      createPublishableSupabaseClient({ SUPABASE_PUBLISHABLE_KEY: "publishable-key" })
    ).toThrow(/SUPABASE_URL/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws when SUPABASE_PUBLISHABLE_KEY is missing", async () => {
    const { createPublishableSupabaseClient } = await import("./create-supabase-client.js");

    expect(() =>
      createPublishableSupabaseClient({ SUPABASE_URL: "https://project.supabase.co" })
    ).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("builds the Supabase client from the provided URL and publishable key", async () => {
    const sentinelClient = { from: vi.fn() } as unknown as SupabaseClient;
    createClientMock.mockReturnValueOnce(sentinelClient);
    const { createPublishableSupabaseClient } = await import("./create-supabase-client.js");

    const client = createPublishableSupabaseClient({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-key"
    });

    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "publishable-key",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) })
    );
    expect(client).toBe(sentinelClient);
  });
});
