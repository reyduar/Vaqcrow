"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import {
  IoAlertCircleOutline,
  IoArrowBackOutline,
  IoCloudOfflineOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoGitNetworkOutline,
  IoLockClosedOutline,
  IoMailUnreadOutline,
  IoPersonOutline,
  IoShieldCheckmarkOutline
} from "react-icons/io5";
import {
  ACCEPT_COPY,
  credentialErrorMessage,
  gatewayErrorMessage,
  LOADING_COPY,
  MISSING_SESSION_COPY,
  type AcceptInvitationErrorMessage,
  validateAcceptInvitationForm
} from "@/application/auth/accept-invitation";
import { DISPLAY_NAME_MAX_LENGTH } from "@/application/auth/sign-up-input";
import type { InvitationCredentialPort } from "@/application/ports/invitation-credential-port";
import type { OperatorInvitationPort } from "@/application/ports/operator-invitation-port";
import { disclosures } from "@/application/trust/disclosures";
import { createBrowserOperatorInvitationPort } from "@/infrastructure/admin/create-operator-invitation-port";
import { createLazyInvitationCredential } from "@/infrastructure/auth/lazy-invitation-credential";
import { createBrowserInvitationCredential } from "@/infrastructure/auth/supabase-invitation-credential";
import { useSession } from "@/state/session-store-provider";
import { AuthField, FOCUS_RING } from "./auth-field";
import { Badge } from "./badge";
import { ThemeSwitcher } from "./theme-switcher";

/**
 * `/accept-invitation`: the operator invitation acceptance (#390/WU5).
 *
 * The invited operator arrives from the GoTrue invite email, which lands here
 * and establishes their session. They set their full name and password; the
 * password is written client-side against Supabase Auth and only the display
 * name travels through the API. The screen is honest about every failure: no
 * session (the link expired or was already used), a weak/rejected password, a
 * provider error, or an API error — it never fakes success.
 */

export interface AcceptInvitationScreenProps {
  /** Injected in tests; production builds the browser ports once. */
  readonly credential?: InvitationCredentialPort;
  readonly gateway?: OperatorInvitationPort;
}

const NO_PRODUCTION = disclosures["no-production"];

export function AcceptInvitationScreen({ credential, gateway }: AcceptInvitationScreenProps) {
  const router = useRouter();
  const status = useSession((state) => state.status);
  const [credentialPort] = useState<InvitationCredentialPort>(
    () => credential ?? createLazyInvitationCredential(createBrowserInvitationCredential)
  );
  const [gatewayPort] = useState<OperatorInvitationPort>(() => gateway ?? createBrowserOperatorInvitationPort());
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordShown, setPasswordShown] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AcceptInvitationErrorMessage | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const validation = validateAcceptInvitationForm({ displayName: name, password, confirmPassword });
  const nameError = tried ? validation.displayName : null;
  const passwordError = tried ? validation.password : null;
  const confirmError = tried ? validation.confirmPassword : null;

  function fail(message: AcceptInvitationErrorMessage) {
    setFailure(message);
    setBusy(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setTried(true);
    setFailure(null);
    if (!validation.valid) {
      const firstInvalid = validation.displayName ? nameRef : validation.password ? passwordRef : confirmRef;
      firstInvalid.current?.focus();
      return;
    }
    setBusy(true);

    const displayName = name.trim();
    const savedPassword = await credentialPort.setPassword(password);
    if (!savedPassword.ok) {
      setPasswordSaved(false);
      fail(credentialErrorMessage(savedPassword.code));
      return;
    }
    // The password is set; a later failure must say so instead of implying the
    // whole acceptance was rolled back.
    setPasswordSaved(true);

    const accepted = await gatewayPort.accept({ displayName });
    if (!accepted.ok) {
      fail(gatewayErrorMessage(accepted.code));
      return;
    }

    setPassword("");
    setConfirmPassword("");
    router.push("/admin");
    // Keep the busy state while navigating away.
  }

  const FailureIcon = failure?.kind === "network" ? IoCloudOfflineOutline : IoAlertCircleOutline;

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-[clamp(24px,6vw,96px)] py-10 text-text-primary">
      <main className="flex w-full max-w-[480px] flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className={`-ml-2 inline-flex h-11 items-center gap-1.5 rounded-control pr-3 pl-2 text-sm font-semibold text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`}
          >
            <IoArrowBackOutline aria-hidden="true" focusable="false" className="text-lg" />
            Volver al inicio
          </Link>
          <div className="ml-auto flex gap-2">
            <Badge variant="demo" label="DEMO" />
            <Badge variant="testnet" label="TESTNET" icon={IoGitNetworkOutline} />
            <ThemeSwitcher />
          </div>
        </div>

        {status === "loading" ? (
          <p role="status" className="m-0 text-base text-text-secondary">
            {LOADING_COPY}
          </p>
        ) : status === "signed-out" ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-page-border bg-page-surface px-5 py-6">
            <IoMailUnreadOutline aria-hidden="true" focusable="false" className="text-2xl text-trust-info" />
            <h1 className="m-0 text-[clamp(26px,3vw,34px)] leading-[1.15] font-bold tracking-[-0.025em]">
              {MISSING_SESSION_COPY.title}
            </h1>
            <p className="m-0 text-base text-pretty text-text-secondary">{MISSING_SESSION_COPY.detail}</p>
            <Link
              href="/login"
              className={`inline-flex h-11 items-center justify-center rounded-control bg-brand-accent px-5 text-base font-[650] text-on-accent no-underline hover:bg-brand-accent-hover ${FOCUS_RING}`}
            >
              {MISSING_SESSION_COPY.cta}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-[clamp(30px,3vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]">
                {ACCEPT_COPY.title}
              </h1>
              <p className="m-0 text-base text-pretty text-text-secondary">{ACCEPT_COPY.subtitle}</p>
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
                  {passwordSaved ? (
                    <span className="mt-1 block">{ACCEPT_COPY.passwordSavedNote}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
              <AuthField
                label={ACCEPT_COPY.nameLabel}
                icon={IoPersonOutline}
                type="text"
                value={name}
                onChange={setName}
                autoComplete="name"
                placeholder={ACCEPT_COPY.namePlaceholder}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                error={nameError}
                disabled={busy}
                inputRef={nameRef}
              />
              <AuthField
                label={ACCEPT_COPY.passwordLabel}
                icon={IoLockClosedOutline}
                type={passwordShown ? "text" : "password"}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                help={{ text: passwordError ?? ACCEPT_COPY.passwordHelp, state: passwordError ? "error" : "idle" }}
                disabled={busy}
                inputRef={passwordRef}
                trailing={
                  <button
                    type="button"
                    onClick={() => setPasswordShown((shown) => !shown)}
                    aria-label={passwordShown ? "Ocultar contraseña" : "Mostrar contraseña"}
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
              <AuthField
                label={ACCEPT_COPY.confirmLabel}
                icon={IoLockClosedOutline}
                type={passwordShown ? "text" : "password"}
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                error={confirmError}
                disabled={busy}
                inputRef={confirmRef}
              />

              <div className="flex gap-3 rounded-2xl border border-page-border bg-page-surface px-4 py-3.5">
                <IoShieldCheckmarkOutline
                  aria-hidden="true"
                  focusable="false"
                  className="mt-px shrink-0 text-xl text-brand-accent-text"
                />
                <p className="m-0 text-sm leading-normal text-pretty">
                  Atribución: cada acción del panel de administración queda auditada con tu nombre.
                </p>
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
                {busy ? ACCEPT_COPY.busy : ACCEPT_COPY.submit}
              </button>
              <p aria-live="polite" className="-mt-2 mb-0 min-h-5 text-center text-[13px] text-text-secondary">
                {busy ? ACCEPT_COPY.busyLive : ""}
              </p>
            </form>
          </>
        )}

        <p className="m-0 self-center text-center text-xs leading-[1.55] text-pretty text-text-secondary">
          <strong className="font-[650] text-text-primary">{`${NO_PRODUCTION.title}.`}</strong> {NO_PRODUCTION.body}
        </p>
      </main>
    </div>
  );
}
