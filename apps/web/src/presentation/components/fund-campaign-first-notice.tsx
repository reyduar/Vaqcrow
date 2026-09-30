import Link from "next/link";
import { demoStepHref } from "@/application/navigation/demo-steps";

/**
 * Shown by a step that acts on a funded campaign when the journey has none:
 * there is nothing to act on, so it says so and points at the funding step.
 */
export function FundCampaignFirstNotice({ action = "continuar" }: { readonly action?: string }) {
  return (
    <p role="status" lang="es" className="text-sm">
      {`Todavía no hay una campaña fondeada: primero hay que fondear la campaña para poder ${action}. `}
      <Link href={demoStepHref("funding")} className="underline">
        Ir al fondeo
      </Link>
    </p>
  );
}
