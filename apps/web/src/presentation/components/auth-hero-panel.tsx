import Link from "next/link";
import type { CSSProperties } from "react";
import { IoGitNetworkOutline, IoKeyOutline } from "react-icons/io5";
import { ROLE_COPY, SCREEN_COPY } from "@/application/auth/auth-form";
import type { AccountRole } from "@/application/ports/auth-session-port";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { FOCUS_RING } from "./auth-field";

/** The isotipo is drawn as a mask so it takes the surrounding colour, as in the template. */
const ISOTIPO_MASK: CSSProperties = {
  WebkitMask: "url(/vaqcrow-isotipo.png) center / contain no-repeat",
  mask: "url(/vaqcrow-isotipo.png) center / contain no-repeat"
};

/**
 * Left panel of `Vaqcrow Onboarding.dc.html` (lines 30–52): the purple
 * "Cómo funciona Vaqcrow" aside with the role's hero, the four model steps
 * and the Testnet / non-custodial chips. Both chips reuse canonical copy
 * (`microcopy.testnetBadge`, the `non-custody` disclosure title).
 */
export function AuthHeroPanel({ role }: { readonly role: AccountRole }) {
  const copy = ROLE_COPY[role];

  return (
    <aside
      aria-label={SCREEN_COPY.asideLabel}
      className="relative flex flex-col justify-between gap-12 overflow-hidden bg-[#8a05be] px-[clamp(24px,6vw,96px)] py-14 text-white"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[120px] -bottom-[110px] h-[508px] w-[520px] bg-white/[0.07]"
        style={ISOTIPO_MASK}
      />
      <Link
        href="/"
        aria-label={SCREEN_COPY.homeLinkLabel}
        className={`relative flex items-center gap-2.5 self-start rounded-md text-white no-underline ${FOCUS_RING} focus-visible:outline-white`}
      >
        <span aria-hidden="true" className="h-10 w-[41px] bg-white" style={ISOTIPO_MASK} />
        <span className="text-[26px] font-bold tracking-[-0.025em]">Vaqcrow</span>
      </Link>
      <div className="relative flex max-w-[520px] flex-col gap-6">
        <h1 className="m-0 text-[clamp(40px,4.6vw,56px)] leading-[1.05] font-bold tracking-[-0.035em] text-balance">
          {copy.heroTitle}
        </h1>
        <p className="m-0 max-w-[44ch] text-lg leading-[1.55] text-pretty">{copy.heroBody}</p>
        <ol className="m-0 mt-2 flex list-none flex-col border-t border-white/28 p-0">
          {SCREEN_COPY.modelSteps.map((step) => (
            <li
              key={step.n}
              className="grid grid-cols-[32px_minmax(0,1fr)] items-baseline gap-3 border-b border-white/28 py-3.5"
            >
              <span className="text-[13px] font-semibold">{step.n}</span>
              <span className="text-[15px] leading-[1.45]">
                <strong className="font-[650]">{step.title}</strong> {step.body}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="relative flex flex-wrap gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-white/60 px-3 text-[13px] font-semibold">
          <IoGitNetworkOutline aria-hidden="true" focusable="false" className="text-[15px]" />
          {microcopy.testnetBadge}
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-white/60 px-3 text-[13px] font-semibold">
          <IoKeyOutline aria-hidden="true" focusable="false" className="text-[15px]" />
          {disclosures["non-custody"].title}
        </span>
      </div>
    </aside>
  );
}
