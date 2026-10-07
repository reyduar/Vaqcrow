"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { IoAlertCircleOutline, IoLockClosedOutline, IoMailOutline } from "react-icons/io5";
import { adminLoginDecision, ADMIN_CONSOLE_PATH } from "@/application/admin/admin-guard";
import { useSession, useSessionStoreApi } from "@/state/session-store-provider";
import { Badge } from "../badge";
import { BrandIsotipo } from "../brand-isotipo";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** The template's single error string; provider codes never reach the screen (D2). */
const INVALID_CREDENTIALS_ERROR = "Correo o contraseña incorrectos.";

/**
 * `/admin`: the operator sign-in of `Vaqcrow Admin.dc.html` (view `login`).
 *
 * Real Supabase Auth replaces the template's demo flag and its "any email and
 * password gets you in" note, which do not ship. Only a verified `ADMIN`
 * enters; a signed-in `ADMIN` visiting `/admin` is sent to the queue, and a
 * non-admin (or deactivated) account is rejected with the same generic
 * credentials error — the console is never revealed (D2).
 */
export function AdminLoginScreen() {
  const router = useRouter();
  const session = useSessionStoreApi();
  const status = useSession((state) => state.status);
  const principal = useSession((state) => state.principal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const decision = adminLoginDecision(status, principal?.role ?? null);

  useEffect(() => {
    if (decision === "enter") router.replace(ADMIN_CONSOLE_PATH);
  }, [decision, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFailure(false);
    setBusy(true);

    const result = await session.getState().signIn({ email, password });
    if (!result.ok) {
      setFailure(true);
      setBusy(false);
      emailRef.current?.focus();
      return;
    }
    if (result.principal.role !== "ADMIN") {
      // D2: a non-admin must not learn anything. Drop the session it just
      // opened and show the same credentials error; a failed discard still
      // shows the error and navigates nowhere.
      await session.getState().discardSession();
      setFailure(true);
      setBusy(false);
      return;
    }
    // Keep the busy state while navigating away.
    router.push(ADMIN_CONSOLE_PATH);
  }

  if (decision !== "render") return null;

  // A signed-in non-admin landed on /admin: same neutral message, no console.
  const showError = failure || status === "signed-in";

  return (
    <div className="grid min-h-screen place-items-center bg-page-surface p-6 text-text-primary">
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        aria-label="Ingreso de administrador"
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-panel border border-page-border bg-raised p-8"
      >
        <div className="flex items-center gap-2.5">
          <BrandIsotipo />
          <div>
            <div className="text-[19px] font-bold tracking-[-0.02em]">Vaqcrow Admin</div>
            <div className="text-xs text-text-secondary">Operación y compliance</div>
          </div>
          <span className="ml-auto">
            <Badge variant="demo" label="DEMO" />
          </span>
        </div>

        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">Ingresar</h1>
          <p className="mt-1 mb-0 text-sm text-text-secondary">
            Solo cuentas de operador creadas por el equipo. No hay registro público.
          </p>
        </div>

        {showError ? (
          <div role="alert" className="flex gap-2 rounded-control bg-trust-critical-surface px-3 py-3 text-sm text-trust-critical">
            <IoAlertCircleOutline aria-hidden="true" focusable="false" className="mt-px shrink-0 text-lg" />
            {INVALID_CREDENTIALS_ERROR}
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Correo</span>
          <span className="flex h-12 items-center gap-2 rounded-control border border-control bg-canvas px-3.5">
            <IoMailOutline aria-hidden="true" focusable="false" className="shrink-0 text-lg text-text-secondary" />
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              disabled={busy}
              className="h-full flex-1 border-0 bg-transparent text-text-primary outline-none"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Contraseña</span>
          <span className="flex h-12 items-center gap-2 rounded-control border border-control bg-canvas px-3.5">
            <IoLockClosedOutline aria-hidden="true" focusable="false" className="shrink-0 text-lg text-text-secondary" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={busy}
              className="h-full flex-1 border-0 bg-transparent text-text-primary outline-none"
            />
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
          className={`flex h-[50px] items-center justify-center rounded-control bg-brand-accent text-base font-[650] text-on-accent transition-colors duration-150 hover:bg-brand-accent-hover disabled:cursor-progress disabled:opacity-85 motion-reduce:transition-none ${FOCUS_RING}`}
        >
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
