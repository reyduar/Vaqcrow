import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, ThemeSwitcher } from "./theme-switcher";

/**
 * Theme choice: `Claro`, `Oscuro` and `Sistema`, persisted under a stable key,
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

  it("offers the three theme choices the design corpus names", () => {
    render(<ThemeSwitcher />);

    expect(screen.getByRole("radio", { name: "Claro" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Oscuro" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeInTheDocument();
  });

  it("applies and persists an explicit dark choice, on both markers", () => {
    render(<ThemeSwitcher />);

    fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }));

    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("restores the persisted choice on mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    render(<ThemeSwitcher />);

    expect(screen.getByRole("radio", { name: "Claro" })).toBeChecked();
  });

  it("resolves Sistema against the OS preference", () => {
    stubSystemDark(true);
    render(<ThemeSwitcher />);

    // Move away from Sistema first: clicking an already-selected radio fires no change.
    fireEvent.click(screen.getByRole("radio", { name: "Claro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("radio", { name: "Sistema" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("survives storage being unavailable and stays on the system-resolved theme", () => {
    const denied = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, clear: denied });

    expect(() => render(<ThemeSwitcher />)).not.toThrow();
    expect(() => fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }))).not.toThrow();

    // Without storage the choice cannot be remembered, so the control reports the
    // system-resolved theme instead of claiming a preference it cannot keep.
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeChecked();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
