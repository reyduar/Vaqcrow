"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import {
  IoAlertCircleOutline,
  IoArrowBackOutline,
  IoBusinessOutline,
  IoCloudOfflineOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoGitNetworkOutline,
  IoLockClosedOutline,
  IoMailOutline,
  IoPersonOutline,
  IoShieldCheckmarkOutline
} from "react-icons/io5";
import {
  authErrorMessage,
  authHref,
  FIELD_COPY,
  homeRouteFor,
  MODE_COPY,
  PASSWORD_MIN_LENGTH,
  ROLE_COPY,
  SCREEN_COPY,
  SIGNED_IN_UNREADABLE_MESSAGE,
  signInRoleMismatch,
  validateAuthForm,
  type AuthErrorMessage,
  type AuthMode
} from "@/application/auth/auth-form";
import { DISPLAY_NAME_MAX_LENGTH } from "@/application/auth/sign-up-input";
import type { AccountRole, AuthErrorCode } from "@/application/ports/auth-session-port";
import { disclosures } from "@/application/trust/disclosures";
import { useSessionStoreApi } from "@/state/session-store-provider";
import { AccountCreatedPanel } from "./account-created-panel";
import { AuthField, FOCUS_RING, type AuthFieldHelpState } from "./auth-field";
import { AuthHeroPanel } from "./auth-hero-panel";
import { Badge } from "./badge";
import { RoleSelector } from "./role-selector";
import { ThemeSwitcher } from "./theme-switcher";

type Phase = "form" | "validating" | "created";

const NO_PRODUCTION = disclosures["no-production"];

export interface AuthScreenProps {
  readonly mode: AuthMode;
  readonly initialRole: AccountRole;
}

/** Sanitized diagnostics: the failure code only, never the provider message or the email. */
function logDiscardFailure(cause: AuthErrorCode): void {
  // eslint-disable-next-line no-console -- a session survived a D14 rejection; the cause is a sanitized code
  console.error("[Auth] session discard failed", { cause });
}

/**
 * `/signup` and `/login`: `Vaqcrow Onboarding.dc.html` in its two modes.
 *
 * Errors appear after the first submit, as in the template. Sign-in redirects
 * by the role the session port verified (D2), never by the selector; the
 * selector must match that role or the sign-in is rejected and the session
 * closed at once (D14). The email lives in its input only: it is never
 * rendered back, and the password is cleared once the account exists.
 */
export function AuthScreen({ mode, initialRole }: AuthScreenProps) {
  const router = useRouter();
  const session = useSessionStoreApi();
  const [role, setRole] = useState<AccountRole>(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordShown, setPasswordShown] = useState(false);
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [failure, setFailure] = useState<AuthErrorMessage | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const copy = ROLE_COPY[role];
  const modeCopy = MODE_COPY[mode];
  const signup = mode === "signup";
  const busy = phase === "validating";
  const validation = validateAuthForm(mode, role, { name, email, password });
  const nameError = tried ? validation.name : null;
  const emailError = tried ? validation.email : null;
  const passwordState: AuthFieldHelpState =
    tried && validation.password !== null ? "error" : password.length >= PASSWORD_MIN_LENGTH ? "ok" : "idle";

  function fail(message: AuthErrorMessage) {
    setFailure(message);
    setPhase("form");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setTried(true);
    setFailure(null);
    if (!validation.valid) {
      const firstInvalid = validation.name ? nameRef : validation.email ? emailRef : passwordRef;
      firstInvalid.current?.focus();
      return;
    }
    setPhase("validating");

    if (!signup) {
      const result = await session.getState().signIn({ email, password });
      if (!result.ok) {
        fail(authErrorMessage("login", result.code));
        return;
      }
      const mismatch = signInRoleMismatch(role, result.principal.role);
      if (mismatch) {
        // D14: keep no session for a sign-in the selected role does not match.
        // A failed sign-out falls back to clearing the local session; if even
        // that fails, the mismatch still shows and nothing navigates.
        const discarded = await session.getState().discardSession();
        if (!discarded.ok) logDiscardFailure(discarded.code);
        fail(mismatch);
        return;
      }
      // Keep the busy state while navigating away.
      router.push(homeRouteFor(result.principal.role));
      return;
    }

    const result = await session.getState().signUp({
      role,
      displayName: name.trim(),
      email,
      password,
      emailRedirectTo: `${window.location.origin}/login`
    });
    if (!result.ok) {
      fail(authErrorMessage("signup", result.code));
      return;
    }
    if (result.status === "signed_in") {
      // The account is already confirmed: never show the "confirm your email"
      // view. Redirect by the verified role, or say plainly how to continue.
      await session.getState().refresh();
      const principal = session.getState().principal;
      setPassword("");
      setPasswordShown(false);
      if (principal) router.push(homeRouteFor(principal.role));
      else fail(SIGNED_IN_UNREADABLE_MESSAGE);
      return;
    }
    setPassword("");
    setPasswordShown(false);
    setPhase("created");
  }

  function backToForm() {
    setPhase("form");
    setTried(false);
    setPassword("");
  }

  const FailureIcon = failure?.kind === "network" ? IoCloudOfflineOutline : IoAlertCircleOutline;

  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] bg-canvas text-text-primary">
      <AuthHeroPanel role={role} />

      <main className="flex flex-col gap-10 px-[clamp(24px,6vw,96px)] pt-8 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className={`-ml-2 inline-flex h-11 items-center gap-1.5 rounded-control pr-3 pl-2 text-sm font-semibold text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`}
          >
            <IoArrowBackOutline aria-hidden="true" focusable="false" className="text-lg" />
            {SCREEN_COPY.backHome}
          </Link>
          <div className="ml-auto flex gap-2">
            <Badge variant="demo" label="DEMO" />
            <Badge variant="testnet" label="TESTNET" icon={IoGitNetworkOutline} />
          </div>
          <ThemeSwitcher />
        </div>

        <div className="m-auto flex w-full max-w-[480px] flex-col gap-7">
          {phase === "created" ? (
            <AccountCreatedPanel role={role} onBack={backToForm} />
          ) : (
            <>
              <RoleSelector value={role} onChange={setRole} />

              <div className="flex flex-col gap-2">
                <h2 className="m-0 text-[clamp(30px,3vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]">
                  {modeCopy.title}
                </h2>
                <p className="m-0 text-base text-pretty text-text-secondary">
                  {signup ? copy.signupSubtitle : copy.loginSubtitle}
                </p>
              </div>

              {failure ? (
                <div
                  role="alert"
                  className="flex gap-3 rounded-2xl bg-trust-critical-surface px-4 py-3.5 text-trust-critical"
                >
                  <FailureIcon aria-hidden="true" focusable="false" className="mt-px shrink-0 text-xl" />
                  <div className="text-sm leading-normal">
                    <strong className="font-[650]">{failure.title}</strong>
                    {failure.detail ? ` ${failure.detail}` : null}
                  </div>
                </div>
              ) : null}

              <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
                {signup ? (
                  <AuthField
                    label={copy.nameLabel}
                    icon={role === "PYME" ? IoBusinessOutline : IoPersonOutline}
                    type="text"
                    value={name}
                    onChange={setName}
                    autoComplete={copy.nameAutocomplete}
                    placeholder={copy.namePlaceholder}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    error={nameError}
                    disabled={busy}
                    inputRef={nameRef}
                  />
                ) : null}
                <AuthField
                  label={FIELD_COPY.emailLabel}
                  icon={IoMailOutline}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  placeholder={FIELD_COPY.emailPlaceholder}
                  error={emailError}
                  disabled={busy}
                  inputRef={emailRef}
                />
                <AuthField
                  label={FIELD_COPY.passwordLabel}
                  icon={IoLockClosedOutline}
                  type={passwordShown ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  autoComplete={signup ? "new-password" : "current-password"}
                  help={{ text: FIELD_COPY.passwordHelp, state: passwordState }}
                  disabled={busy}
                  inputRef={passwordRef}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setPasswordShown((shown) => !shown)}
                      aria-label={passwordShown ? FIELD_COPY.hidePassword : FIELD_COPY.showPassword}
                      aria-pressed={passwordShown ? "true" : "false"}
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-transparent text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
                    >
                      {passwordShown ? (
                        <IoEyeOffOutline aria-hidden="true" focusable="false" className="text-[19px]" />
                      ) : (
                        <IoEyeOutline aria-hidden="true" focusable="false" className="text-[19px]" />
                      )}
                    </button>
                  }
                />

                <div className="flex gap-3 rounded-2xl border border-page-border bg-page-surface px-4 py-3.5">
                  <IoShieldCheckmarkOutline
                    aria-hidden="true"
                    focusable="false"
                    className="mt-px shrink-0 text-xl text-brand-accent-text"
                  />
                  <p className="m-0 text-sm leading-normal text-pretty">{SCREEN_COPY.custodyNote}</p>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy ? "true" : undefined}
                  className={`flex h-[52px] items-center justify-center gap-2.5 rounded-control bg-brand-accent text-base font-[650] text-on-accent transition-colors duration-150 hover:bg-brand-accent-hover disabled:cursor-progress disabled:opacity-85 motion-reduce:transition-none ${FOCUS_RING}`}
                >
                  {busy ? (
                    <span
                      aria-hidden="true"
                      className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none"
                    />
                  ) : null}
                  {busy ? SCREEN_COPY.busyLabel : modeCopy.submit}
                </button>
                <p aria-live="polite" className="-mt-2 mb-0 min-h-5 text-center text-[13px] text-text-secondary">
                  {busy ? SCREEN_COPY.busyLive : SCREEN_COPY.idleLive}
                </p>
              </form>

              <p className="m-0 text-center text-[15px] text-text-secondary">
                {modeCopy.switchPrompt}{" "}
                <Link
                  href={authHref(signup ? "login" : "signup", role)}
                  className={`font-semibold text-brand-accent-text underline-offset-[3px] hover:text-text-primary ${FOCUS_RING}`}
                >
                  {modeCopy.switchLabel}
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="m-0 max-w-[560px] self-center text-center text-xs leading-[1.55] text-pretty text-text-secondary">
          <strong className="font-[650] text-text-primary">{`${NO_PRODUCTION.title}.`}</strong>{" "}
          {NO_PRODUCTION.body}
        </p>
      </main>
    </div>
  );
}
