"use client";

import type { KeyboardEvent } from "react";
import { useRef } from "react";
import { IoPersonOutline, IoStorefrontOutline } from "react-icons/io5";
import { ROLE_COPY, SCREEN_COPY } from "@/application/auth/auth-form";
import type { AccountRole } from "@/application/ports/auth-session-port";
import { FOCUS_RING } from "./auth-field";

const OPTIONS: readonly { readonly role: AccountRole; readonly icon: typeof IoPersonOutline }[] = [
  { role: "INVERSOR", icon: IoPersonOutline },
  { role: "PYME", icon: IoStorefrontOutline }
];

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * «Soy inversor / Soy PyME» (`Vaqcrow Onboarding.dc.html` lines 70–74): a
 * `radiogroup` of two 44 px segments. Keyboard behaviour follows the ARIA
 * radio group pattern: only the checked option is in the tab order, and the
 * arrow keys move both focus and selection.
 */
export function RoleSelector({
  value,
  onChange
}: {
  readonly value: AccountRole;
  readonly onChange: (role: AccountRole) => void;
}) {
  const refs = useRef<Partial<Record<AccountRole, HTMLButtonElement | null>>>({});

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = NEXT_KEYS.has(event.key) ? 1 : PREVIOUS_KEYS.has(event.key) ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length];
    if (!next) return;
    onChange(next.role);
    refs.current[next.role]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={SCREEN_COPY.roleGroupLabel}
      className="grid grid-cols-2 gap-1 rounded-xl border border-page-border bg-page-surface p-1"
    >
      {OPTIONS.map(({ role, icon: Icon }, index) => {
        const checked = role === value;
        return (
          <button
            key={role}
            ref={(node) => {
              refs.current[role] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked ? "true" : "false"}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(role)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex h-11 items-center justify-center gap-2 rounded-[9px] text-[15px] text-text-primary transition-colors duration-150 motion-reduce:transition-none ${FOCUS_RING} ${
              checked ? "border border-control bg-canvas font-[650]" : "border border-transparent bg-transparent font-medium"
            }`}
          >
            <Icon aria-hidden="true" focusable="false" className="text-lg" />
            {ROLE_COPY[role].selectorLabel}
          </button>
        );
      })}
    </div>
  );
}
