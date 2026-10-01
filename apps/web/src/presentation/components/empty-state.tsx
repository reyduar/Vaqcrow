import type { IconType } from "react-icons";
import { Button, type ButtonVariant } from "./button";

/**
 * EmptyState primitive (Issue #310 / T1): title, body, and an optional
 * action rendered through the shared `Button` — e.g. "Limpiar filtros" on
 * `Explorar PyMEs` when no campaign matches the active filters. Distinct
 * from HeroUI's own `EmptyState` (a minimal "no results" placeholder meant
 * for a `ListBox` popover, already used inside `combo-box.tsx`): this one is
 * a full section-level state with a title, a decorative icon and an action.
 */
export interface EmptyStateAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
}

export interface EmptyStateProps {
  readonly title: string;
  readonly body: string;
  readonly action?: EmptyStateAction;
  /** Decorative only — react-icons/io5 icon, always rendered aria-hidden. */
  readonly icon?: IconType;
  readonly className?: string;
}

export function EmptyState({ title, body, action, icon: Icon, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 p-8 text-center ${className ?? ""}`.trim()}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" className="h-10 w-10 text-text-secondary" /> : null}
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">{body}</p>
      {action ? (
        <Button variant={action.variant ?? "secondary"} onPress={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
