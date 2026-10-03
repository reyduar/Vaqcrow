import type { ReactNode } from "react";

/**
 * Page title block of `Vaqcrow Portafolio.dc.html` (logged-in view): a
 * 34–48 px title, a 17 px secondary subtitle and an optional action aligned to
 * the bottom right.
 */
export function PageHeading({
  title,
  subtitle,
  action
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex max-w-[680px] min-w-0 flex-[1_1_420px] flex-col gap-2.5">
        <h1 className="m-0 text-[clamp(34px,4vw,48px)] leading-[1.1] font-bold tracking-[-0.03em]">{title}</h1>
        <p className="m-0 text-[17px] leading-[1.55] text-pretty text-text-secondary">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
