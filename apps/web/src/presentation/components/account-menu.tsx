"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "./avatar";

export interface AccountMenuItem {
  readonly label: string;
  readonly href?: string;
  readonly onSelect?: () => void;
}

export interface AccountMenuProps {
  readonly name: string;
  readonly subtitle?: string;
  readonly avatarSrc?: string;
  readonly items: readonly AccountMenuItem[];
}

/**
 * Presentational account menu for `DemoNavbar`'s actions slot. Without menu
 * items it renders a non-interactive account identity rather than an empty
 * trigger; callers own the available navigation and session actions.
 */
export function AccountMenu({ name, subtitle, avatarSrc, items }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const hasItems = items.length > 0;

  const closeMenu = (returnFocus = false) => {
    setIsOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const identity = (
    <>
      <Avatar name={name} {...(avatarSrc ? { src: avatarSrc } : {})} isDecorative />
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
        {subtitle ? <span className="block truncate text-xs text-muted">{subtitle}</span> : null}
      </span>
    </>
  );

  if (!hasItems) {
    // Template header control (`Vaqcrow Sistema.dc.html` line 52): 44 px high,
    // control radius, `--control` border. Non-interactive identity here, so it
    // is a plain group rather than a button.
    return (
      <div className="inline-flex h-11 items-center gap-2 rounded-control border border-control px-3.5">
        {identity}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-11 items-center gap-2 rounded-control border border-control px-3.5 text-left outline-none transition-colors hover:bg-page-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        {...(isOpen ? { "aria-controls": menuId } : {})}
        onClick={() => setIsOpen((open) => !open)}
      >
        {identity}
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`Cuenta de ${name}`}
          className="absolute right-0 top-full z-10 mt-2 min-w-48 rounded-control border border-border bg-surface p-1 shadow"
        >
          {items.map((item) => {
            const className =
              "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus-visible:bg-muted";
            const select = () => {
              item.onSelect?.();
              closeMenu();
            };

            return item.href ? (
              <a key={item.label} role="menuitem" href={item.href} className={className} onClick={select}>
                {item.label}
              </a>
            ) : (
              <button key={item.label} type="button" role="menuitem" className={className} onClick={select}>
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
