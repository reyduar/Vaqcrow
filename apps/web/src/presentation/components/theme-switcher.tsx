"use client";

import { useEffect, useSyncExternalStore } from "react";
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

  // Syncing the DOM with the resolved theme is what effects are for; it is not
  // state mirroring.
  useEffect(() => {
    applyTheme(choice);
  }, [choice, systemTheme]);

  return (
    // The template's control (`Vaqcrow Landing.dc.html` header): a `Tema`
    // group of three icon buttons with `aria-pressed`, over a 1 px `--border`
    // at the control radius on `--surface` (2 px padding and no gap instead of
    // the template's 3 px and 2 px, to absorb part of the larger targets). The
    // pressed choice gets the `--control` border on `--canvas`: a shape cue,
    // not only colour (`demo-ui.md` §5.8). Deviation, recorded: 44 px buttons
    // instead of the template's 36 px, for the minimum touch target.
    <div
      role="group"
      aria-label="Tema"
      className="inline-flex rounded-control border border-border bg-page-surface p-0.5"
    >
      {CHOICES.map(({ value, label, icon: Icon }) => {
        const pressed = choice === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            title={label}
            onClick={() => writeChoice(value)}
            className={`grid size-11 cursor-pointer place-items-center rounded-[7px] border text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
              pressed ? "border-control bg-canvas" : "border-transparent bg-transparent hover:bg-canvas"
            }`}
          >
            <Icon aria-hidden="true" focusable="false" className="text-base" />
          </button>
        );
      })}
    </div>
  );
}
