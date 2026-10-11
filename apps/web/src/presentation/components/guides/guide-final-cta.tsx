import Link from "next/link";
import type { GuideFinalCta as GuideFinalCtaData } from "@/application/guides/types";
import { GUIDE_ICONS } from "./guide-icons";

/**
 * The guide's closing band (`Vaqcrow Guia emprendedores.dc.html` `:132-135`,
 * `Vaqcrow Guia de inversion.dc.html` `:131-134`): the accent panel with the
 * title, the body and the single call to action. Both guides' targets are app
 * routes, so the CTA goes through `next/link`.
 */
export function GuideFinalCta({ finalCta }: { readonly finalCta: GuideFinalCtaData }) {
  const ArrowIcon = GUIDE_ICONS["arrow-forward-outline"];

  return (
    <div
      data-guide-final-cta=""
      className="flex flex-wrap items-center justify-between gap-6 rounded-panel bg-brand-accent p-10 text-on-accent"
    >
      <div className="flex max-w-[44ch] flex-col gap-2">
        <h2 className="m-0 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">{finalCta.title}</h2>
        <p className="m-0 text-base leading-[1.55]">{finalCta.body}</p>
      </div>
      <Link
        href={finalCta.cta.href}
        className="inline-flex h-12 items-center gap-2 rounded-control bg-canvas px-5 text-[15px] font-semibold text-text-primary no-underline transition-colors hover:bg-brand-accent-tint"
      >
        {finalCta.cta.label}
        <ArrowIcon aria-hidden="true" focusable="false" className="text-[17px]" />
      </Link>
    </div>
  );
}
