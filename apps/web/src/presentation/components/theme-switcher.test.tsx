import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, ThemeSwitcher } from "./theme-switcher";

/**
 * Theme choice: `Tema claro`, `Tema oscuro` and `Tema del sistema`, persisted
 * under a stable key, applied through both markers HeroUI documents (the `dark`
 * class and the `data-theme` attribute), and `Sistema` following the OS
 * preference.
 *
 * Since #500 the three choices are collapsed behind one 46 px trigger that opens
 * a menu (owner decision, to give the public header back the width a fifth nav
 * entry needs); the template drew three 44 px buttons instead.
 */
function stubSystemDark(isDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: isDark && query.includes("prefers-color-scheme: dark"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      }) as unknown as MediaQueryList
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Tema" }));
  return screen.getByRole("menu", { name: "Tema" });
}

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    root.classList.remove("dark", "light");
    root.style.colorScheme = "";
    stubSystemDark(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collapses the choices behind one icon trigger, closed by default", () => {
    render(<ThemeSwitcher />);

    const trigger = screen.getByRole("button", { name: "Tema" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Icon only: the name comes from aria-label, the tooltip from title.
    expect(trigger).toHaveTextContent("");
    expect(trigger).toHaveAttribute("title", "Tema");
    expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    // The 44 px touch target and the focus ring survive the collapse.
    expect(trigger.className).toMatch(/\bsize-11\b/);
    expect(trigger.className).toMatch(/focus-visible:outline-focus-ring/);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a menu with the three choices, the stored one checked", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSwitcher />);

    const menu = openMenu();
    const items = within(menu).getAllByRole("menuitemradio");

    expect(items.map((item) => item.textContent)).toEqual(["Tema claro", "Tema oscuro", "Tema del sistema"]);
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
  });

  it("applies and persists an explicit dark choice on both markers, and closes the menu", () => {
    render(<ThemeSwitcher />);

    fireEvent.click(within(openMenu()).getByRole("menuitemradio", { name: "Tema oscuro" }));

    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<ThemeSwitcher />);

    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tema" }));
  });

  it("restores the persisted choice on mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    render(<ThemeSwitcher />);

    const checked = within(openMenu()).getByRole("menuitemradio", { name: "Tema claro" });
    expect(checked).toHaveAttribute("aria-checked", "true");
  });

  it("resolves Sistema against the OS preference", () => {
    stubSystemDark(true);
    render(<ThemeSwitcher />);

    fireEvent.click(within(openMenu()).getByRole("menuitemradio", { name: "Tema claro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(within(openMenu()).getByRole("menuitemradio", { name: "Tema del sistema" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("survives storage being unavailable and stays on the system-resolved theme", () => {
    const denied = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, clear: denied });

    expect(() => render(<ThemeSwitcher />)).not.toThrow();
    expect(() => {
      fireEvent.click(within(openMenu()).getByRole("menuitemradio", { name: "Tema oscuro" }));
    }).not.toThrow();

    // Without storage the choice cannot be remembered, so the control reports the
    // system-resolved theme instead of claiming a preference it cannot keep.
    const checked = within(openMenu()).getByRole("menuitemradio", { name: "Tema del sistema" });
    expect(checked).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
