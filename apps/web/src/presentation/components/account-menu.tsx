"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { IconType } from "react-icons";
import { IoChevronDownOutline } from "react-icons/io5";
import { Avatar } from "./avatar";

export interface AccountMenuItem {
  readonly label: string;
  readonly href?: string;
  readonly onSelect?: () => void;
  readonly icon?: IconType;
  /** Draws the template's separator above this item (e.g. before "Cerrar sesión"). */
  readonly separatorBefore?: boolean;
}

export interface AccountMenuProps {
  readonly name: string;
  readonly subtitle?: string;
  readonly avatarSrc?: string;
  readonly items: readonly AccountMenuItem[];
  /**
   * `identity` (default): avatar plus visible name in the trigger.
   * `avatar`: the role-aware header of `Vaqcrow Landing.dc.html` /
   * `Vaqcrow Portafolio.dc.html` — avatar and chevron only, with the name and
   * the role chip in the menu's header (no "Sesión de demostración" line).
   */
  readonly variant?: "identity" | "avatar";
  /** Accessible name of the `avatar` trigger, e.g. "Menú de cuenta de Lucía Fernández". */
  readonly triggerLabel?: string;
  readonly roleChip?: { readonly label: string; readonly icon?: IconType };
}

/**
 * The template's round role avatar (`Vaqcrow Landing.dc.html`): a white disc
 * with the portrait as a background zoomed to 150 % around the face. A CSS
 * background renders without waiting for an image load, so the avatar never
 * flashes initials first. Decorative: the name is announced elsewhere.
 */
function PortraitAvatar({ src, size }: { readonly src: string; readonly size: "trigger" | "header" }) {
  return (
    <span
      aria-hidden="true"
      data-avatar-src={src}
      className={`block shrink-0 overflow-hidden rounded-full border border-border bg-white ${
        size === "trigger" ? "size-10" : "size-[60px]"
      }`}
    >
      <span
        className="block size-full bg-[length:150%] bg-[position:50%_12%] bg-no-repeat"
        style={{ backgroundImage: `url("${src}")` }}
      />
    </span>
  );
}

/**
 * Presentational account menu for `DemoNavbar`'s actions slot. Without menu
 * items it renders a non-interactive account identity rather than an empty
 * trigger; callers own the available navigation and session actions.
 */
export function AccountMenu({
  name,
  subtitle,
  avatarSrc,
  items,
  variant = "identity",
  triggerLabel,
  roleChip
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

    // WAI-ARIA menu button: opening the menu moves focus to its first item.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function menuItems(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  /** Arrow keys, Home and End move focus between the items, wrapping around. */
  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
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

  /**
   * Focus moving to an element outside the menu (Tab, Shift+Tab) closes it and
   * leaves focus where the user sent it. A `null` related target (a pointer
   * press on a non-focusable spot) is left to the outside-pointer handler.
   */
  function handleFocusOut(event: ReactFocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && !wrapperRef.current?.contains(next)) closeMenu();
  }

  const identity = (
    <>
      <Avatar name={name} {...(avatarSrc ? { src: avatarSrc } : {})} isDecorative />
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
        {subtitle ? <span className="block truncate text-xs text-muted">{subtitle}</span> : null}
      </span>
    </>
  );

  const isAvatar = variant === "avatar";
  const ChipIcon = roleChip?.icon;

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
    <div ref={wrapperRef} className="relative inline-flex" onBlur={handleFocusOut}>
      {isAvatar ? (
        // Template trigger: 48 px pill, 40 px round avatar and a chevron.
        <button
          ref={triggerRef}
          type="button"
          aria-label={triggerLabel ?? name}
          className="inline-flex h-12 items-center gap-1.5 rounded-full border border-border bg-transparent pr-2 pl-1 text-text-primary outline-none transition-colors hover:bg-page-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          {...(isOpen ? { "aria-controls": menuId } : {})}
          onClick={() => setIsOpen((open) => !open)}
        >
          {avatarSrc ? (
            <PortraitAvatar src={avatarSrc} size="trigger" />
          ) : (
            <Avatar name={name} isDecorative className="size-10" />
          )}
          <IoChevronDownOutline aria-hidden="true" focusable="false" className="text-base" />
        </button>
      ) : (
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
      )}

      {isOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          aria-label={`Cuenta de ${name}`}
          className={
            isAvatar
              ? "absolute right-0 top-[calc(100%+8px)] z-20 flex w-[300px] max-w-[calc(100vw-32px)] flex-col rounded-2xl border border-border bg-raised p-1.5 shadow-[0_24px_48px_-12px_rgba(17,17,17,0.28)]"
              : "absolute right-0 top-full z-10 mt-2 min-w-48 rounded-control border border-border bg-surface p-1 shadow"
          }
        >
          {isAvatar ? (
            // Menu header: 60 px avatar, name and role chip; never the email.
            <div className="mb-1.5 flex items-center gap-3.5 border-b border-border px-3 pt-3.5 pb-4">
              {avatarSrc ? (
                <PortraitAvatar src={avatarSrc} size="header" />
              ) : (
                <Avatar name={name} isDecorative className="size-[60px] shrink-0" />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-base leading-tight font-bold break-words text-text-primary">{name}</span>
                {roleChip ? (
                  <span className="inline-flex h-[22px] items-center gap-1 self-start rounded-full bg-brand-accent-tint px-2 text-[11px] font-[650] tracking-[0.04em] text-brand-accent-text">
                    {ChipIcon ? <ChipIcon aria-hidden="true" focusable="false" className="text-[13px]" /> : null}
                    {roleChip.label}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {items.map((item) => {
            const className = isAvatar
              ? "flex min-h-11 w-full items-center gap-3 rounded-[10px] bg-transparent px-3 text-left text-sm font-semibold text-text-primary no-underline outline-none hover:bg-page-surface focus-visible:bg-page-surface"
              : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus-visible:bg-muted";
            const select = () => {
              item.onSelect?.();
              closeMenu();
            };
            const Icon = item.icon;
            const content = (
              <>
                {Icon ? <Icon aria-hidden="true" focusable="false" className="shrink-0 text-[19px]" /> : null}
                {item.label}
              </>
            );

            return (
              <Fragment key={item.label}>
                {item.separatorBefore ? <div role="separator" className="mx-1 my-1.5 h-px bg-border" /> : null}
                {item.href ? (
                  <Link role="menuitem" href={item.href} className={className} onClick={select}>
                    {content}
                  </Link>
                ) : (
                  <button type="button" role="menuitem" className={className} onClick={select}>
                    {content}
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
