"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import type { IconType } from "react-icons";
import { IoDesktopOutline, IoMoonOutline, IoSunnyOutline } from "react-icons/io5";

/**
 * Theme choice persisted for the demo, per `demo-ui.md` §5.8: `Claro`, `Oscuro`
 * or `Sistema`, remembered under a stable key, with `Sistema` following
 * `prefers-color-scheme` and reacting to changes.
 *
 * The preference is an **external system** (storage plus the OS media query), so
 * it is read with `useSyncExternalStore` rather than mirrored into state from an
 * effect: the server snapshot is the neutral default, the client snapshot is the
 * stored choice, and React reconciles the two without a cascading render. The
 * bootstrap script in `layout.tsx` already applied the effective theme before
 * first paint; this component only keeps it in sync afterwards.
 *
 * **Collapsed into a menu (owner decision, 2026-10-13, #500).** The template
 * draws three 44 px icon buttons over a bordered group (~138 px). The public
 * header needed ~85 px back to fit a fifth nav entry, so the same three choices
 * now live behind one 46 px trigger that opens a `menu` of `menuitemradio`
 * items — the current choice's icon on the trigger, which is the affordance.
 * Measured by `e2e/app-header.spec.ts`: it reclaims ~92 px at 1280 px, wide text
 * included. The deviation from the template is deliberate and recorded here.
 */
export const THEME_STORAGE_KEY = "vaqcrow-theme";

export type ThemeChoice = "light" | "dark" | "system";

/** The template's `themeOptions` (`Vaqcrow Landing.dc.html`): label and icon per choice. */
const CHOICES: readonly { readonly value: ThemeChoice; readonly label: string; readonly icon: IconType }[] = [
  { value: "light", label: "Tema claro", icon: IoSunnyOutline },
  { value: "dark", label: "Tema oscuro", icon: IoMoonOutline },
  { value: "system", label: "Tema del sistema", icon: IoDesktopOutline }
];

const DARK_QUERY = "(prefers-color-scheme: dark)";
const SERVER_SNAPSHOT = "system|light";

const listeners = new Set<() => void>();

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DARK_QUERY).matches
  );
}

function readChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage can be unavailable; the default below is the fallback.
  }
  return "system";
}

/** Choice and the resolved OS preference, as one stable string so React can compare it. */
function readSnapshot(): string {
  return `${readChoice()}|${prefersDark() ? "dark" : "light"}`;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  const query = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
  const onSystemChange = () => onStoreChange();
  query?.addEventListener("change", onSystemChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
    query?.removeEventListener("change", onSystemChange);
  };
}

/** Applies the effective theme. Both markers move together because HeroUI documents both. */
function applyTheme(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && prefersDark());
  const root = document.documentElement;
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

function writeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Persisting is best-effort; the choice still applies for this session.
  }
  for (const listener of listeners) listener();
}

export function ThemeSwitcher() {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => SERVER_SNAPSHOT);
  const [choice, systemTheme] = snapshot.split("|") as [ThemeChoice, string];
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Syncing the DOM with the resolved theme is what effects are for; it is not
  // state mirroring.
  useEffect(() => {
    applyTheme(choice);
  }, [choice, systemTheme]);

  function closeMenu(returnFocus = false) {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };

    // WAI-ARIA menu button: focus the selected choice, so the menu opens where
    // the user already is.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  /** Arrow keys, Home and End move focus between the choices, wrapping around. */
  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLElement);
    const next: Record<string, number> = {
      ArrowDown: (current + 1) % items.length,
      ArrowUp: (current - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1
    };
    const target = next[event.key];
    if (target === undefined) return;

    event.preventDefault();
    items[target]?.focus();
  }

  /** Focus leaving the compound control (Tab) closes it where the user sent focus. */
  function handleFocusOut(event: ReactFocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && !wrapperRef.current?.contains(next)) closeMenu();
  }

  const Current = CHOICES.find((option) => option.value === choice) ?? CHOICES[2]!;

  return (
    <div ref={wrapperRef} className="relative inline-flex" onBlur={handleFocusOut}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        {...(isOpen ? { "aria-controls": menuId } : {})}
        aria-label="Tema"
        title="Tema"
        onClick={() => setIsOpen((open) => !open)}
        className="grid size-11 cursor-pointer place-items-center rounded-control border border-border bg-page-surface text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <Current.icon aria-hidden="true" focusable="false" className="text-base" />
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Tema"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-20 mt-2 flex min-w-48 flex-col rounded-control border border-border bg-canvas p-1 shadow"
        >
          {CHOICES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={choice === value}
              onClick={() => {
                writeChoice(value);
                closeMenu(true);
              }}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] bg-transparent px-3 text-left text-sm font-semibold text-text-primary outline-none hover:bg-page-surface focus-visible:bg-page-surface"
            >
              <Icon aria-hidden="true" focusable="false" className="shrink-0 text-[19px]" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
