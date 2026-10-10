"use client";

import type { ReactNode, Ref } from "react";
import { useId } from "react";
import type { IconType } from "react-icons";
import { IoAlertCircleOutline, IoCheckmarkOutline, IoInformationCircleOutline } from "react-icons/io5";

/** 2 px focus ring in the template's `--focus` colour (`*:focus-visible`). */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export type AuthFieldHelpState = "idle" | "ok" | "error";

export interface AuthFieldProps {
  readonly label: string;
  readonly icon: IconType;
  readonly type: "text" | "email" | "password";
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
  /** Visible error, linked through `aria-describedby`; `null` hides it. */
  readonly error?: string | null;
  /** Always-visible help whose colour and icon follow its state (the password rule). */
  readonly help?: { readonly text: string; readonly state: AuthFieldHelpState };
  readonly disabled?: boolean;
  readonly inputRef?: Ref<HTMLInputElement>;
  /** Control rendered inside the field after the input (the show/hide toggle). */
  readonly trailing?: ReactNode;
}

const HELP_TREATMENT: Readonly<Record<AuthFieldHelpState, { icon: IconType; className: string }>> = {
  idle: { icon: IoInformationCircleOutline, className: "text-text-secondary" },
  ok: { icon: IoCheckmarkOutline, className: "text-text-primary" },
  error: { icon: IoAlertCircleOutline, className: "text-trust-critical" }
};

/**
 * Text field of the onboarding screen (`Vaqcrow Onboarding.dc.html` lines
 * 90–115): a 48 px control with a leading icon, a 1 px `--control` border that
 * becomes 2 px `--err-t` when invalid, and 13 px error/help rows.
 *
 * Deviation, recorded: the template wraps everything in one `<label>`, which
 * would fold the error and the toggle's name into the input's accessible
 * name; here the label targets the input with `htmlFor` instead. The error is
 * referenced from `aria-describedby` only while it is visible, so a hidden
 * message is never announced. Native elements rather than the HeroUI
 * `TextField` primitive: that primitive has no leading icon or in-field
 * control slot.
 */
export function AuthField({
  label,
  icon: Icon,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  maxLength,
  error = null,
  help,
  disabled = false,
  inputRef,
  trailing
}: AuthFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const helpId = useId();
  const invalid = error !== null || help?.state === "error";
  const describedBy = [help ? helpId : null, error !== null ? errorId : null].filter(Boolean).join(" ");
  const helpTreatment = help ? HELP_TREATMENT[help.state] : null;
  const HelpIcon = helpTreatment?.icon;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <span
        className={`flex h-12 items-center gap-2.5 rounded-control bg-canvas pl-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring ${
          trailing ? "pr-1" : "pr-3.5"
        } ${invalid ? "border-2 border-trust-critical" : "border border-control"}`}
      >
        <Icon aria-hidden="true" focusable="false" className="shrink-0 text-lg text-text-secondary" />
        <input
          ref={inputRef}
          id={inputId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={invalid ? "true" : "false"}
          aria-describedby={describedBy || undefined}
          className="min-w-0 flex-1 border-none bg-transparent text-text-primary outline-none placeholder:text-text-secondary disabled:opacity-70"
        />
        {trailing}
      </span>
      {error !== null ? (
        <span id={errorId} className="flex items-center gap-1 text-[13px] font-medium text-trust-critical">
          <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[15px]" />
          {error}
        </span>
      ) : null}
      {help && helpTreatment && HelpIcon ? (
        <span id={helpId} className={`flex items-center gap-1 text-[13px] font-medium ${helpTreatment.className}`}>
          <HelpIcon aria-hidden="true" focusable="false" className="shrink-0 text-[15px]" />
          {help.text}
        </span>
      ) : null}
    </div>
  );
}
