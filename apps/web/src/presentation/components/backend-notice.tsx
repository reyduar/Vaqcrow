import { IoInformationCircleOutline } from "react-icons/io5";

/**
 * BackendNotice primitive (Issue #480).
 *
 * The honest counterpart of `ErrorState` for the one condition that is NOT a
 * failure: this build has no API configured (`NEXT_PUBLIC_API_BASE_URL` is
 * unset, so every browser port is the null object and answers
 * `{ ok: false, code: "not_configured" }`). Before #480 that condition rendered
 * the *failure* copy («El servicio no respondió»), which is false — the service
 * did not fail, it was never wired up — and painted it in the danger red.
 *
 * It is deliberately calmer than `ErrorState`:
 * - `role="status"`, not `role="alert"`: this is a settled, non-urgent state,
 *   not something assistive tech must interrupt for.
 * - no retry action: retrying cannot configure a backend, so offering one would
 *   be a dead end.
 *
 * Copy is Spanish and owner-reviewable; it never names a variable or a provider
 * to the end user.
 */
export const BACKEND_NOTICE_COPY = Object.freeze({
  title: "Esta instancia no tiene configurada la API",
  body: "No hay una API de Vaqcrow configurada, así que la pantalla no puede mostrar datos. No es un fallo del servicio y no se modificó nada."
});

export interface BackendNoticeProps {
  readonly className?: string;
}

export function BackendNotice({ className }: BackendNoticeProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-start gap-2 rounded-card border border-page-border bg-raised p-6 text-text-primary ${className ?? ""}`.trim()}
    >
      <div className="flex items-center gap-2">
        <IoInformationCircleOutline aria-hidden="true" focusable="false" className="text-xl text-trust-caution" />
        <p className="m-0 text-base font-semibold">{BACKEND_NOTICE_COPY.title}</p>
      </div>
      <p className="m-0 text-sm text-text-secondary">{BACKEND_NOTICE_COPY.body}</p>
    </div>
  );
}
