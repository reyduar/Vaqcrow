"use client";

import { Button as HeroButton, Spinner } from "@heroui/react";
import type { ReactNode } from "react";
import { useId } from "react";

/**
 * Button primitive (Issue #306 / T1). Wraps HeroUI's `Button` so the app has
 * one shared button with the project's own variant vocabulary
 * (primary/secondary/ghost/destructive) instead of loose HeroUI usage per
 * form. Two states are project requirements, not just HeroUI defaults:
 * `isLoading` always changes the visible label (never only a spinner) and
 * sets `aria-busy`; a disabled button with a `disabledReason` always renders
 * that reason as visible text linked via `aria-describedby`, never only a
 * tooltip.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly type?: "button" | "submit" | "reset";
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly isLoading?: boolean;
  /** Visible text shown instead of `children` while `isLoading` is true. */
  readonly loadingLabel?: string;
  readonly isDisabled?: boolean;
  /** Visible reason rendered under the button and linked via aria-describedby when isDisabled. */
  readonly disabledReason?: string;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

const VARIANT_TO_HEROUI: Readonly<Record<ButtonVariant, "primary" | "secondary" | "ghost" | "danger">> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "danger"
};

/**
 * Variant treatments from `Vaqcrow Sistema.dc.html` §04 "Botones" (lines
 * 185–188): 44 px high, control radius (10 px), 15 px / 600 type, padding
 * 18 px (14 px for the ghost) and the template's own hover. The classes below
 * sit in Tailwind's utilities layer, so they win over HeroUI's component
 * defaults without forking its stylesheet.
 */
const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    "h-11 px-[18px] rounded-control bg-brand-accent text-on-accent hover:bg-brand-accent-hover",
  secondary:
    "h-11 px-[18px] rounded-control border border-control bg-transparent text-text-primary hover:bg-page-surface",
  ghost: "h-11 px-[14px] rounded-control bg-transparent text-text-primary hover:bg-page-surface",
  destructive:
    "h-11 px-[18px] rounded-control border border-trust-critical bg-transparent text-trust-critical hover:bg-trust-critical-surface"
};

export function Button({
  variant = "primary",
  type = "button",
  children,
  onPress,
  isLoading = false,
  loadingLabel,
  isDisabled = false,
  disabledReason,
  fullWidth = false,
  className
}: ButtonProps) {
  const reasonId = useId();
  const showReason = isDisabled && Boolean(disabledReason);

  return (
    <div className="inline-flex flex-col gap-1">
      <HeroButton
        type={type}
        variant={VARIANT_TO_HEROUI[variant]}
        isDisabled={isDisabled || isLoading}
        isPending={isLoading}
        fullWidth={fullWidth}
        className={`text-[15px] font-semibold ${VARIANT_CLASSES[variant]}${className ? ` ${className}` : ""}`}
        {...(showReason ? { "aria-describedby": reasonId } : {})}
        {...(onPress ? { onPress } : {})}
        // HeroUI's Button filters "aria-busy" out of the DOM props it forwards
        // (see button.tsx's `{...rest}` spread onto react-aria-components'
        // Button); the `render` override is the documented escape hatch to
        // still set it, and `type` must be re-applied explicitly here since
        // the override also drops it back to its own default otherwise.
        render={(props) => <button {...props} type={type} aria-busy={isLoading ? "true" : undefined} />}
      >
        {isLoading ? (
          <>
            <Spinner aria-hidden="true" color="current" size="sm" />
            {loadingLabel ?? "Cargando…"}
          </>
        ) : (
          children
        )}
      </HeroButton>
      {showReason ? (
        <span id={reasonId} className="text-sm text-muted">
          {disabledReason}
        </span>
      ) : null}
    </div>
  );
}
