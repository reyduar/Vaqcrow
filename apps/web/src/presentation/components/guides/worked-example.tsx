import type { GuideWorkedExample } from "@/application/guides/types";

/**
 * The guide's worked example (`Vaqcrow Guia emprendedores.dc.html` `:130`,
 * `Vaqcrow Guia de inversion.dc.html` `:129`): a two-column surface block with
 * the declaration rows and the deterministic result. The investor example adds
 * the optional rounding row, so it renders only when the data carries it.
 *
 * Every visible string comes from `GuideWorkedExample` — the canonical
 * «Cálculo determinístico…» footnote included — so the calculation is never
 * retyped in the renderer.
 */
export function WorkedExample({ example }: { readonly example: GuideWorkedExample }) {
  return (
    <div
      data-worked-example=""
      className="grid max-w-[560px] grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 rounded-card bg-page-surface p-5 text-[15px]"
    >
      <span className="text-text-secondary">
        {example.salesLabel}
        <span className="ml-1 text-[11px] font-[650] tracking-[0.04em] text-text-primary">· {example.salesTag}</span>
      </span>
      <span className="text-right">{example.salesValue}</span>

      <span className="text-text-secondary">{example.ruleLabel}</span>
      <span className="text-right">{example.ruleValue}</span>

      {example.roundingLabel && example.roundingValue ? (
        <>
          <span className="text-text-secondary">{example.roundingLabel}</span>
          <span className="text-right">{example.roundingValue}</span>
        </>
      ) : null}

      <span className="border-t border-border pt-2.5 font-[650]">{example.resultLabel}</span>
      <span className="border-t border-border pt-2 text-right text-[20px] font-bold">{example.resultValue}</span>

      <span className="col-span-2 text-[13px] text-text-secondary">{example.footnote}</span>
    </div>
  );
}
