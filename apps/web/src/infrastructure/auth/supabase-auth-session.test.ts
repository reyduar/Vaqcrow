import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthSessionError } from "@/application/ports/auth-session-port";
import {
  SupabaseAuthSession,
  SupabaseConfigError,
  readSupabaseBrowserConfig,
  type SupabaseSessionClient
} from "./supabase-auth-session";

const USER_ID = "8f0c1d7e-0000-4000-8000-000000000001";
const SESSION = { access_token: "jwt.access.token", user: { id: USER_ID, email: "ana@example.test" } };

function apiError(status: number, code?: string) {
  return Object.assign(new Error("provider message ana@example.test"), { name: "AuthApiError", status, code });
}

type ProfileResult = { data: { role: unknown; display_name: unknown } | null; error: unknown };

function fakeClient(overrides: {
  signUp?: ReturnType<typeof vi.fn>;
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
  getSession?: ReturnType<typeof vi.fn>;
  profile?: ProfileResult | (() => Promise<ProfileResult>);
} = {}) {
  const unsubscribe = vi.fn();
  let authListener: ((event: string, session: unknown) => void) | undefined;
  const eq = vi.fn();
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const profile = overrides.profile ?? { data: { role: "INVERSOR", display_name: "Ana Pérez" }, error: null };
  eq.mockImplementation(() => ({
    maybeSingle: () => (typeof profile === "function" ? profile() : Promise.resolve(profile))
  }));
  const auth = {
    signUp: overrides.signUp ?? vi.fn().mockResolvedValue({ data: { user: { id: USER_ID }, session: null }, error: null }),
    signInWithPassword:
      overrides.signInWithPassword ?? vi.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
    signOut: overrides.signOut ?? vi.fn().mockResolvedValue({ error: null }),
    getSession: overrides.getSession ?? vi.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
    onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      authListener = callback;
      return { data: { subscription: { unsubscribe } } };
    })
  };
  const client = { auth, from } as unknown as SupabaseSessionClient;
  return { client, auth, from, select, eq, unsubscribe, emit: (event: string) => authListener?.(event, null) };
}

async function failureOf(promise: Promise<unknown>): Promise<AuthSessionError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(AuthSessionError);
  return error as AuthSessionError;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("readSupabaseBrowserConfig", () => {
  it("returns the URL and publishable key when both are present", () => {
    expect(readSupabaseBrowserConfig({ url: " https://ref.supabase.example.test ", publishableKey: " sb_publishable_x " })).toEqual({
      url: "https://ref.supabase.example.test",
      publishableKey: "sb_publishable_x"
    });
  });

  it("names every missing variable without printing any value", () => {
    const error = (() => {
      try {
        readSupabaseBrowserConfig({ url: "", publishableKey: undefined });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(SupabaseConfigError);
    expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("rejects a non-http URL without echoing it", () => {
    expect(() => readSupabaseBrowserConfig({ url: "ftp://secret-host", publishableKey: "k" })).toThrow(SupabaseConfigError);
    try {
      readSupabaseBrowserConfig({ url: "ftp://secret-host", publishableKey: "k" });
    } catch (e) {
      expect((e as Error).message).not.toContain("secret-host");
    }
  });
});

describe("SupabaseAuthSession.signUp", () => {
  it("sends role and display_name as user metadata, with the redirect", async () => {
    const { client, auth } = fakeClient();
    const port = new SupabaseAuthSession(client);

    const outcome = await port.signUp({
      role: "PYME",
      displayName: " Panadería Horizonte ",
      email: " owner@example.test ",
      password: "secret-123",
      emailRedirectTo: "https://web.example.test/login"
    });

    expect(outcome).toEqual({ status: "confirmation_required" });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: "secret-123",
      options: {
        data: { role: "PYME", display_name: "Panadería Horizonte" },
        emailRedirectTo: "https://web.example.test/login"
      }
    });
  });

  it("omits emailRedirectTo when not given", async () => {
    const { client, auth } = fakeClient();
    await new SupabaseAuthSession(client).signUp({
      role: "INVERSOR",
      displayName: "Ana",
      email: "ana@example.test",
      password: "p"
    });
    expect(auth.signUp.mock.calls[0]![0].options).toEqual({ data: { role: "INVERSOR", display_name: "Ana" } });
  });

  it("reports signed_in when the provider opens a session right away", async () => {
    const { client } = fakeClient({
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID }, session: SESSION }, error: null })
    });
    const outcome = await new SupabaseAuthSession(client).signUp({
      role: "INVERSOR",
      displayName: "Ana",
      email: "ana@example.test",
      password: "p"
    });
    expect(outcome).toEqual({ status: "signed_in" });
  });

  it("rejects invalid input without calling the provider", async () => {
    const { client, auth } = fakeClient();
    const error = await failureOf(
      new SupabaseAuthSession(client).signUp({ role: "ADMIN" as never, displayName: "Ana", email: "a@b.c", password: "p" })
    );
    expect(error.code).toBe("invalid_input");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("maps a provider error to a sanitized code", async () => {
    const { client } = fakeClient({
      signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: apiError(422, "user_already_exists") })
    });
    const error = await failureOf(
      new SupabaseAuthSession(client).signUp({ role: "INVERSOR", displayName: "Ana", email: "a@b.c", password: "p" })
    );
    expect(error.code).toBe("email_taken");
    expect(error.message).not.toContain("provider message");
  });

  it("maps a thrown network failure to network", async () => {
    const { client } = fakeClient({ signUp: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) });
    const error = await failureOf(
      new SupabaseAuthSession(client).signUp({ role: "INVERSOR", displayName: "Ana", email: "a@b.c", password: "p" })
    );
    expect(error.code).toBe("network");
  });
});

describe("SupabaseAuthSession.signIn", () => {
  it("resolves the principal from the user's own profile row, never from the session", async () => {
    const { client, auth, from, select, eq } = fakeClient({
      profile: { data: { role: "PYME", display_name: "Panadería Horizonte" }, error: null }
    });

    const principal = await new SupabaseAuthSession(client).signIn({ email: " owner@example.test ", password: "p" });

    expect(principal).toEqual({ role: "PYME", displayName: "Panadería Horizonte" });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "owner@example.test", password: "p" });
    expect(from).toHaveBeenCalledWith("profile");
    expect(select).toHaveBeenCalledWith("role, display_name");
    expect(eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(JSON.stringify(principal)).not.toContain("example.test");
  });

  it.each([
    ["invalid_credentials", "invalid_credentials"],
    ["email_not_confirmed", "email_not_confirmed"]
  ])("maps the provider code %s", async (code, expected) => {
    const { client } = fakeClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: apiError(400, code) })
    });
    const error = await failureOf(new SupabaseAuthSession(client).signIn({ email: "a@b.c", password: "p" }));
    expect(error.code).toBe(expected);
  });

  it("fails as unavailable and drops the local session when the profile is missing", async () => {
    const { client, auth } = fakeClient({ profile: { data: null, error: null } });
    const error = await failureOf(new SupabaseAuthSession(client).signIn({ email: "a@b.c", password: "p" }));
    expect(error.code).toBe("unavailable");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it.each([
    ["an unknown role", { role: "SUPERUSER", display_name: "Ana" }],
    ["a missing display name", { role: "INVERSOR", display_name: null }],
    ["a blank display name", { role: "INVERSOR", display_name: "  " }]
  ])("treats a profile with %s as unavailable", async (_label, row) => {
    const { client } = fakeClient({ profile: { data: row, error: null } });
    const error = await failureOf(new SupabaseAuthSession(client).signIn({ email: "a@b.c", password: "p" }));
    expect(error.code).toBe("unavailable");
  });

  it("maps a profile read error without leaking PostgREST details", async () => {
    const { client } = fakeClient({
      profile: { data: null, error: { code: "42501", message: "permission denied", details: "x", hint: "grant" } }
    });
    const error = await failureOf(new SupabaseAuthSession(client).signIn({ email: "a@b.c", password: "p" }));
    expect(error.code).toBe("unavailable");
    expect(JSON.stringify(error)).not.toContain("permission denied");
  });

  it("accepts an ADMIN profile", async () => {
    const { client } = fakeClient({ profile: { data: { role: "ADMIN", display_name: "Admin Vaqcrow" }, error: null } });
    expect(await new SupabaseAuthSession(client).signIn({ email: "a@b.c", password: "p" })).toEqual({
      role: "ADMIN",
      displayName: "Admin Vaqcrow"
    });
  });
});

describe("SupabaseAuthSession session reads", () => {
  it("reports signed-out when there is no session, without reading a profile", async () => {
    const { client, from } = fakeClient({
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    });
    expect(await new SupabaseAuthSession(client).getSession()).toEqual({ status: "signed-out" });
    expect(from).not.toHaveBeenCalled();
  });

  it("reports signed-in with the profile principal", async () => {
    const { client } = fakeClient();
    expect(await new SupabaseAuthSession(client).getSession()).toEqual({
      status: "signed-in",
      principal: { role: "INVERSOR", displayName: "Ana Pérez" }
    });
  });

  it("rejects with unavailable when a session has no readable profile", async () => {
    const { client } = fakeClient({ profile: { data: null, error: null } });
    expect((await failureOf(new SupabaseAuthSession(client).getSession())).code).toBe("unavailable");
  });

  it("returns the access token, or null when signed out or failing", async () => {
    expect(await new SupabaseAuthSession(fakeClient().client).getAccessToken()).toBe("jwt.access.token");
    const signedOut = fakeClient({ getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) });
    expect(await new SupabaseAuthSession(signedOut.client).getAccessToken()).toBeNull();
    const failing = fakeClient({ getSession: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) });
    expect(await new SupabaseAuthSession(failing.client).getAccessToken()).toBeNull();
  });

  it("signs out and maps a failure", async () => {
    const ok = fakeClient();
    await new SupabaseAuthSession(ok.client).signOut();
    expect(ok.auth.signOut).toHaveBeenCalledTimes(1);

    const failing = fakeClient({ signOut: vi.fn().mockResolvedValue({ error: apiError(0) }) });
    expect((await failureOf(new SupabaseAuthSession(failing.client).signOut())).code).toBe("network");
  });
});

describe("SupabaseAuthSession.onSessionChange", () => {
  it("notifies outside the provider callback and unsubscribes", () => {
    vi.useFakeTimers();
    const { client, emit, unsubscribe } = fakeClient();
    const listener = vi.fn();

    const stop = new SupabaseAuthSession(client).onSessionChange(listener);
    emit("SIGNED_IN");
    // Deferred: calling back into Supabase from inside onAuthStateChange can deadlock.
    expect(listener).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith();

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    emit("SIGNED_OUT");
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
