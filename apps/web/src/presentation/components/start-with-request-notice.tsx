import Link from "next/link";
import { demoStepHref } from "@/application/navigation/demo-steps";

/**
 * Shown by every step that needs the journey's application when none is
 * known: there is nothing to act on, so it says so and points at the request.
 */
export function StartWithRequestNotice({ action = "continuar" }: { readonly action?: string }) {
  return (
    <p
      role="status"
      lang="es"
      className="m-0 rounded-card border border-border p-4 text-sm text-text-secondary"
    >
      {`Todavía no hay una solicitud enviada: primero hay que enviar la solicitud para poder ${action}. `}
      <Link href={demoStepHref("request")} className="underline">
        Ir a la solicitud
      </Link>
    </p>
  );
}
