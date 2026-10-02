"use client";

import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  IoArrowForwardOutline,
  IoBarChartOutline,
  IoBookOutline,
  IoCheckmarkCircleOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoWalletOutline
} from "react-icons/io5";
import { CREATED_COPY, ROLE_COPY, type NextStepIcon } from "@/application/auth/auth-form";
import type { AccountRole } from "@/application/ports/auth-session-port";
import { FOCUS_RING } from "./auth-field";

const STEP_ICONS: Readonly<Record<NextStepIcon, IconType>> = {
  document: IoDocumentTextOutline,
  chart: IoBarChartOutline,
  wallet: IoWalletOutline,
  search: IoSearchOutline,
  book: IoBookOutline
};

/**
 * The template's `created` phase (`Vaqcrow Onboarding.dc.html` lines
 * 132–155) with the owner overrides of D7: the banner asks to confirm the
 * email and shows the role, never the email itself; the view is «Conectá tu
 * wallet» for both roles; and «Conectar Freighter» only explains that the
 * account must be confirmed first (the wallet connection lands with
 * #406/#426). Focus moves to the heading when the view appears.
 */
export function AccountCreatedPanel({
  role,
  confirmed,
  onBack
}: {
  readonly role: AccountRole;
  /** Whether the new account can already sign in; right after signup it cannot. */
  readonly confirmed: boolean;
  readonly onBack: () => void;
}) {
  const copy = ROLE_COPY[role];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div role="status" className="flex gap-3 rounded-2xl bg-trust-success-surface p-4 text-trust-success">
        <IoCheckmarkCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[22px]" />
        <div className="text-sm leading-normal">
          <strong className="text-[15px] font-[650]">{CREATED_COPY.bannerTitle}</strong> {CREATED_COPY.bannerBody}
          <br />
          {copy.createdLabel}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className={`m-0 text-[clamp(30px,3vw,40px)] leading-[1.15] font-bold tracking-[-0.025em] ${FOCUS_RING}`}
        >
          {CREATED_COPY.title}
        </h2>
        <p className="m-0 text-base text-pretty text-text-secondary">{CREATED_COPY.body}</p>
      </div>
      <ol aria-label={CREATED_COPY.stepsLabel} className="m-0 flex list-none flex-col gap-2 p-0">
        {copy.nextSteps.map((step) => {
          const Icon = STEP_ICONS[step.icon];
          return (
            <li key={step.label} className="flex items-center gap-3 rounded-xl border border-page-border px-4 py-3.5">
              <Icon aria-hidden="true" focusable="false" className="shrink-0 text-xl" />
              <span className="flex-1 text-[15px] font-medium">{step.label}</span>
              <span className="text-xs text-text-secondary">{step.tag}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            if (!confirmed) setNotice(CREATED_COPY.confirmFirst);
          }}
          className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-control bg-brand-accent px-[18px] text-base font-[650] text-on-accent transition-colors duration-150 hover:bg-brand-accent-hover motion-reduce:transition-none ${FOCUS_RING}`}
        >
          {CREATED_COPY.connect}
          <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-lg" />
        </button>
        <button
          type="button"
          onClick={onBack}
          className={`h-[52px] rounded-control border border-control bg-transparent px-[18px] text-[15px] font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
        >
          {CREATED_COPY.back}
        </button>
      </div>
      <p role="status" className="m-0 min-h-5 text-sm text-text-primary">
        {notice}
      </p>
    </div>
  );
}
