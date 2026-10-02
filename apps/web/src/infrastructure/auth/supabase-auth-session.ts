import { normalizeSignInInput, normalizeSignUpInput } from "@/application/auth/sign-up-input";
import {
  AuthSessionError,
  type AuthSessionPort,
  type PrincipalRole,
  type SessionPrincipal,
  type SessionSnapshot,
  type SignInInput,
  type SignUpInput,
  type SignUpOutcome
} from "@/application/ports/auth-session-port";
import { toAuthSessionError } from "./supabase-auth-errors";

interface SessionLike {
  readonly access_token: string;
  readonly user: { readonly id: string };
}

interface ProfileRow {
  readonly role: unknown;
  readonly display_name: unknown;
}

/**
 * The slice of the Supabase browser client this adapter uses. Structural, so
 * tests inject a double and the SDK types stay out of the port.
 */
export interface SupabaseSessionClient {
  readonly auth: {
    signUp(credentials: {
      email: string;
      password: string;
      options: { data: { role: string; display_name: string }; emailRedirectTo?: string };
    }): PromiseLike<{ data: { session: SessionLike | null }; error: unknown }>;
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): PromiseLike<{ data: { session: SessionLike | null }; error: unknown }>;
    signOut(options?: { scope?: "global" | "local" | "others" }): PromiseLike<{ error: unknown }>;
    getSession(): PromiseLike<{ data: { session: SessionLike | null }; error: unknown }>;
    onAuthStateChange(callback: (event: string, session: unknown) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
  };
  from(table: "profile"): {
    select(columns: "role, display_name"): {
      eq(column: "user_id", value: string): {
        maybeSingle(): PromiseLike<{ data: ProfileRow | null; error: unknown }>;
      };
    };
  };
}

const PRINCIPAL_ROLES: readonly PrincipalRole[] = ["PYME", "INVERSOR", "ADMIN"];

/** A profile row becomes a principal only when its role and name are well formed. */
function toPrincipal(row: ProfileRow | null): SessionPrincipal {
  if (row === null) throw new AuthSessionError("unavailable");
  const { role, display_name: displayName } = row;
  if (typeof role !== "string" || !(PRINCIPAL_ROLES as readonly string[]).includes(role)) {
    throw new AuthSessionError("unavailable");
  }
  if (typeof displayName !== "string" || displayName.trim() === "") throw new AuthSessionError("unavailable");
  return { role: role as PrincipalRole, displayName: displayName.trim() };
}

/** Runs a provider call and maps both returned and thrown errors to `AuthSessionError`. */
async function call<T extends { error: unknown }>(run: () => PromiseLike<T>): Promise<T> {
  let result: T;
  try {
    result = await run();
  } catch (error) {
    throw toAuthSessionError(error);
  }
  if (result.error) throw toAuthSessionError(result.error);
  return result;
}

/**
 * Supabase Auth implementation of `AuthSessionPort`. The role and display name
 * always come from the signed-in user's own `public.profile` row (RLS policy
 * `profile_select_own`), read with that user's JWT; the email and the
 * provider session never leave this class except as the bare access token.
 */
export class SupabaseAuthSession implements AuthSessionPort {
  constructor(private readonly client: SupabaseSessionClient) {}

  async signUp(input: SignUpInput): Promise<SignUpOutcome> {
    const { role, displayName, email, password, emailRedirectTo } = normalizeSignUpInput(input);
    const { data } = await call(() =>
      this.client.auth.signUp({
        email,
        password,
        options: {
          data: { role, display_name: displayName },
          ...(emailRedirectTo !== undefined ? { emailRedirectTo } : {})
        }
      })
    );
    return data.session ? { status: "signed_in" } : { status: "confirmation_required" };
  }

  async signIn(input: SignInInput): Promise<SessionPrincipal> {
    const credentials = normalizeSignInInput(input);
    const { data } = await call(() => this.client.auth.signInWithPassword(credentials));
    if (!data.session) throw new AuthSessionError("unavailable");
    try {
      return await this.readPrincipal(data.session.user.id);
    } catch (error) {
      // A session without a usable profile is not a usable sign-in: drop it locally.
      await Promise.resolve(this.client.auth.signOut({ scope: "local" })).catch(() => undefined);
      throw toAuthSessionError(error);
    }
  }

  async signOut(): Promise<void> {
    await call(() => this.client.auth.signOut());
  }

  async getSession(): Promise<SessionSnapshot> {
    const { data } = await call(() => this.client.auth.getSession());
    if (!data.session) return { status: "signed-out" };
    return { status: "signed-in", principal: await this.readPrincipal(data.session.user.id) };
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error || !data.session) return null;
      return data.session.access_token;
    } catch {
      return null;
    }
  }

  onSessionChange(listener: () => void): () => void {
    let active = true;
    const { data } = this.client.auth.onAuthStateChange(() => {
      // Calling back into Supabase from inside this callback can deadlock the
      // auth lock, and listeners do re-read the session: defer them.
      setTimeout(() => {
        if (active) listener();
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }

  private async readPrincipal(userId: string): Promise<SessionPrincipal> {
    const { data } = await call(() =>
      this.client.from("profile").select("role, display_name").eq("user_id", userId).maybeSingle()
    );
    return toPrincipal(data);
  }
}

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export interface SupabaseBrowserConfig {
  readonly url: string;
  readonly publishableKey: string;
}

/**
 * Validates the two public variables. Errors name the variables, never their
 * values. The publishable key is browser-safe by design; the service-role key
 * never belongs here.
 */
export function readSupabaseBrowserConfig(env: {
  readonly url: string | undefined;
  readonly publishableKey: string | undefined;
}): SupabaseBrowserConfig {
  const url = env.url?.trim() ?? "";
  const publishableKey = env.publishableKey?.trim() ?? "";
  const missing = [
    ...(url === "" ? ["NEXT_PUBLIC_SUPABASE_URL"] : []),
    ...(publishableKey === "" ? ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : [])
  ];
  if (missing.length > 0) {
    throw new SupabaseConfigError(`Supabase browser configuration is missing: ${missing.join(", ")}.`);
  }
  if (!/^https?:\/\//.test(url)) {
    throw new SupabaseConfigError("NEXT_PUBLIC_SUPABASE_URL must be an http(s) URL.");
  }
  return { url, publishableKey };
}
