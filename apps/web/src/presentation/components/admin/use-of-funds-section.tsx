import { USE_OF_FUNDS_COPY, useOfFundsText } from "@/application/admin/review";
import type { AdminReviewContext } from "@/application/ports/admin-review-port";

export interface UseOfFundsSectionProps {
  readonly context: AdminReviewContext;
}

/**
 * The «Destino de los fondos» block of the admin review (#577): the PyME's own
 * words from wizard step 2, read-only. The template does not design it, so it
 * reuses the review sections' card idiom. The text is a plain React text node —
 * never markup — and a company that declared none reads «Sin dato».
 */
export function UseOfFundsSection({ context }: UseOfFundsSectionProps) {
  return (
    <section
      aria-labelledby="use-of-funds-title"
      className="flex flex-col gap-3.5 rounded-card border border-page-border p-[22px] text-text-primary"
    >
      <h2 id="use-of-funds-title" className="m-0 text-lg font-bold">
        {USE_OF_FUNDS_COPY.title}
      </h2>
      <p className="m-0 max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-line text-text-secondary">
        {useOfFundsText(context.company)}
      </p>
    </section>
  );
}
