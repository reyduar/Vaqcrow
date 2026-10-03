/**
 * Test-only in-memory `AuthSessionPort`. No network, no Supabase.
 *
 * It mirrors the adapter's observable contract: inputs are normalized with the
 * same rules, failures are `AuthSessionError` codes, the principal carries
 * role and display name only, and session changes notify listeners
 * asynchronously (like the deferred Supabase callback).
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import { normalizeSignInInput, normalizeSignUpInput } from "@/application/auth/sign-up-input";
import {
  AuthSessionError,
  type AuthErrorCode,
  type AuthSessionPort,
  type PrincipalRole,
  type SessionPrincipal,
  type SessionSnapshot,
  type SignInInput,
  type SignUpInput,
  type SignUpOutcome
} from "@/application/ports/auth-session-port";

export interface FakeAccount {
  readonly email: string;
  readonly password: string;
  readonly role: PrincipalRole;
  readonly displayName: string;
  /** Defaults to `true`. */
  readonly confirmed?: boolean;
}

type Operation = "signUp" | "signIn" | "signOut" | "getSession";

export class FakeAuthSession implements AuthSessionPort {
  /** Signup requests received, without passwords. */
  readonly signUps: Array<{ role: string; displayName: string; email: string }> = [];
  private readonly accounts = new Map<string, FakeAccount & { confirmed: boolean }>();
  private readonly failures = new Map<Operation, AuthErrorCode>();
  private readonly listeners = new Set<() => void>();
  private current: SessionPrincipal | null = null;
  private heldGetSession: Promise<void> | null = null;
  private signUpOutcome: SignUpOutcome = { status: "confirmation_required" };
  private signUpOpensSession = true;
  token = "fake-access-token";

  get listenerCount(): number {
    return this.listeners.size;
  }

  seedAccount(account: FakeAccount): void {
    this.accounts.set(account.email, { ...account, confirmed: account.confirmed ?? true });
  }

  /** The next call of `operation` rejects with `code`. */
  failNext(operation: Operation, code: AuthErrorCode): void {
    this.failures.set(operation, code);
  }

  /** Makes signUp open a session right away (email confirmation off). */
  confirmSignUpsImmediately(): void {
    this.signUpOutcome = { status: "signed_in" };
  }

  /**
   * Makes signUp report `signed_in` without leaving a readable session: the
   * provider claims a session that `getSession()` then reports as signed out.
   */
  reportSignUpsAsSignedInWithoutSession(): void {
    this.signUpOutcome = { status: "signed_in" };
    this.signUpOpensSession = false;
  }

  /**
   * Holds the next `getSession()` resolution until the returned release is
   * called. The snapshot is taken when the call starts.
   */
  holdNextGetSession(): () => void {
    let release!: () => void;
    this.heldGetSession = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  async signUp(input: SignUpInput): Promise<SignUpOutcome> {
    this.throwIfFailing("signUp");
    const normalized = normalizeSignUpInput(input);
    this.signUps.push({ role: normalized.role, displayName: normalized.displayName, email: normalized.email });
    const confirmed = this.signUpOutcome.status === "signed_in";
    this.seedAccount({ ...normalized, confirmed });
    if (confirmed && this.signUpOpensSession) this.setCurrent({ role: normalized.role, displayName: normalized.displayName });
    return this.signUpOutcome;
  }

  async signIn(input: SignInInput): Promise<SessionPrincipal> {
    this.throwIfFailing("signIn");
    const { email, password } = normalizeSignInInput(input);
    const account = this.accounts.get(email);
    if (!account || account.password !== password) throw new AuthSessionError("invalid_credentials");
    if (!account.confirmed) throw new AuthSessionError("email_not_confirmed");
    const principal = { role: account.role, displayName: account.displayName };
    this.setCurrent(principal);
    return principal;
  }

  async signOut(): Promise<void> {
    this.throwIfFailing("signOut");
    this.setCurrent(null);
  }

  async getSession(): Promise<SessionSnapshot> {
    const failure = this.failures.get("getSession");
    this.failures.delete("getSession");
    const snapshot: SessionSnapshot = this.current
      ? { status: "signed-in", principal: this.current }
      : { status: "signed-out" };
    const held = this.heldGetSession;
    this.heldGetSession = null;
    if (held) await held;
    if (failure) throw new AuthSessionError(failure);
    return snapshot;
  }

  async getAccessToken(): Promise<string | null> {
    return this.current ? this.token : null;
  }

  onSessionChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setCurrent(principal: SessionPrincipal | null): void {
    this.current = principal;
    for (const listener of [...this.listeners]) setTimeout(listener, 0);
  }

  private throwIfFailing(operation: Operation): void {
    const code = this.failures.get(operation);
    if (code) {
      this.failures.delete(operation);
      throw new AuthSessionError(code);
    }
  }
}
