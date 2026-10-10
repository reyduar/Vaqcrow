import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, ThemeSwitcher } from "./theme-switcher";

/**
 * Theme choice: `Claro`, `Oscuro` and `Sistema` as the template's three icon
 * buttons (`Tema claro` / `Tema oscuro` / `Tema del sistema`), persisted under a stable key,
 * applied through both markers HeroUI documents (the `dark` class and the
 * `data-theme` attribute), and `Sistema` following the OS preference.
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

  it("offers the three theme choices as the template's icon buttons, each with an accessible name", () => {
    render(<ThemeSwitcher />);

    const group = screen.getByRole("group", { name: "Tema" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Tema claro",
      "Tema oscuro",
      "Tema del sistema"
    ]);
    for (const button of buttons) {
      // Icon only, as in the template: the name comes from aria-label, the tooltip from title.
      expect(button).toHaveTextContent("");
      expect(button).toHaveAttribute("title", button.getAttribute("aria-label") ?? "");
      expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("keeps 44 px targets and a visible focus ring", () => {
    render(<ThemeSwitcher />);

    for (const button of within(screen.getByRole("group", { name: "Tema" })).getAllByRole("button")) {
      expect(button.className).toMatch(/\bsize-11\b/);
      expect(button.className).toMatch(/focus-visible:outline-focus-ring/);
    }
  });

  it("marks only the selected choice as pressed, with a border shape and not only colour", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSwitcher />);

    const pressed = screen.getByRole("button", { name: "Tema oscuro" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(pressed.className).toMatch(/\bborder-control\b/);
    expect(screen.getByRole("button", { name: "Tema claro" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Tema del sistema" })).toHaveAttribute("aria-pressed", "false");
  });

  it("applies and persists an explicit dark choice, on both markers", () => {
    render(<ThemeSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Tema oscuro" }));

    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Tema oscuro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the persisted choice on mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    render(<ThemeSwitcher />);

    expect(screen.getByRole("button", { name: "Tema claro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("resolves Sistema against the OS preference", () => {
    stubSystemDark(true);
    render(<ThemeSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Tema claro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Tema del sistema" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("survives storage being unavailable and stays on the system-resolved theme", () => {
    const denied = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, clear: denied });

    expect(() => render(<ThemeSwitcher />)).not.toThrow();
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Tema oscuro" }))).not.toThrow();

    // Without storage the choice cannot be remembered, so the control reports the
    // system-resolved theme instead of claiming a preference it cannot keep.
    expect(screen.getByRole("button", { name: "Tema del sistema" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
