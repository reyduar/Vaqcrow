"use client";

import { Radio, RadioGroup } from "@heroui/react";
import { useEffect, useSyncExternalStore } from "react";

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

const CHOICES: readonly { readonly value: ThemeChoice; readonly label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" }
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
    <RadioGroup
      aria-label="Tema"
      name={THEME_STORAGE_KEY}
      orientation="horizontal"
      value={choice}
      onChange={(next) => writeChoice(next as ThemeChoice)}
      className="text-sm"
    >
      {CHOICES.map((option) => (
        <Radio key={option.value} value={option.value}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {option.label}
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}
