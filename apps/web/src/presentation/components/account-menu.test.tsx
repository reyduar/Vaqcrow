import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu, type AccountMenuItem } from "./account-menu";

const ITEMS: readonly AccountMenuItem[] = [
  { label: "Mi perfil", href: "/profile" },
  { label: "Cerrar sesión", onSelect: vi.fn() }
];

describe("AccountMenu", () => {
  it("renders an accessible trigger with the visible user label and delegated initials fallback", () => {
    render(<AccountMenu name="Lucía Fernández" subtitle="Inversor" items={ITEMS} />);

    const trigger = screen.getByRole("button", { name: /Lucía Fernández/ });
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Lucía Fernández")).toBeInTheDocument();
    expect(screen.getByText("Inversor")).toBeInTheDocument();
    expect(screen.getByText("LF")).toBeInTheDocument();
  });

  it("links the open trigger to a menu panel and renders every caller item only while open", () => {
    render(<AccountMenu name="Lucía Fernández" items={ITEMS} />);

    const trigger = screen.getByRole("button", { name: /Lucía Fernández/ });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Mi perfil" })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const menu = screen.getByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(menu.id).not.toBe("");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(ITEMS.length);
    expect(within(menu).getByRole("menuitem", { name: "Mi perfil" })).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<AccountMenu name="Lucía Fernández" items={ITEMS} />);

    const trigger = screen.getByRole("button", { name: /Lucía Fernández/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes on an actual outside pointer interaction", () => {
    render(
      <>
        <AccountMenu name="Lucía Fernández" items={ITEMS} />
        <button type="button">Fuera</button>
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: /Lucía Fernández/ }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Fuera" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes after a selection and preserves link and action behavior", () => {
    const onSelect = vi.fn();
    const items: readonly AccountMenuItem[] = [
      { label: "Mi perfil", href: "/profile" },
      { label: "Cerrar sesión", onSelect }
    ];
    render(<AccountMenu name="Lucía Fernández" items={items} />);

    const trigger = screen.getByRole("button", { name: /Lucía Fernández/ });
    fireEvent.click(trigger);
    const profile = screen.getByRole("menuitem", { name: "Mi perfil" });
    expect(profile).toHaveAttribute("href", "/profile");
    fireEvent.click(profile);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders an account identity, not an empty menu control, when there are no items", () => {
    render(<AccountMenu name="Lucía Fernández" avatarSrc="https://example.invalid/avatar.png" items={[]} />);

    expect(screen.getByText("Lucía Fernández")).toBeInTheDocument();
    expect(screen.getByText("LF")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lucía Fernández/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
