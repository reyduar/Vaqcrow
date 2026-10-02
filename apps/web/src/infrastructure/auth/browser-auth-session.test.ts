import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserAuthSession } from "./browser-auth-session";
import { SupabaseAuthSession, SupabaseConfigError } from "./supabase-auth-session";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createBrowserAuthSession", () => {
  it("fails clearly, naming the variables, when the configuration is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => createBrowserAuthSession()).toThrow(SupabaseConfigError);
    expect(() => createBrowserAuthSession()).toThrow(/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("builds the Supabase adapter without any network call", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(createBrowserAuthSession()).toBeInstanceOf(SupabaseAuthSession);
  });
});
