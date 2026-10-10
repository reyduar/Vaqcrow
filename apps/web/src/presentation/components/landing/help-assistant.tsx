"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { IoChatbubbleEllipsesOutline, IoChevronForwardOutline, IoCloseOutline, IoSendOutline } from "react-icons/io5";
import { BrandIsotipo } from "../brand-isotipo";

/**
 * The floating «Ayuda» assistant of `Vaqcrow Landing.dc.html` (lines 268-281,
 * Feature #418, WU4). A Client Component because it owns open/closed state; it
 * is mounted by the landing only. Faithful to the template: a fixed bottom-right
 * stack with a pill toggle whose icon swaps between a chat bubble and a close
 * cross (`assistIcon`), and, when open, a 340 px panel with the brand header,
 * the greeting bubble, three quick links and a disabled question field.
 *
 * Decoding of the template (recorded, not left implicit):
 * - **Brand purple.** The template hardcodes `#8A05BE` / `#7304A0`; those are the
 *   app's `bg-brand-accent` / `bg-brand-accent-hover` tokens, so the literal is
 *   never retyped (they are the same value the app already ships).
 * - **Header isotipo.** The template draws a white mask on the purple header.
 *   `BrandIsotipo` colours itself with `bg-logo` (purple on light, white on
 *   dark), which would vanish on the light-theme purple header, so the wrapper
 *   overrides the mark's background to `bg-on-accent` (white in both themes)
 *   rather than forking the shared component.
 * - **Routes.** The quick links and «Ir al centro de ayuda» point at `/help`
 *   (owned by #394) and the in-page `#limites` anchor. The help center is not
 *   built yet: a 404 is accepted on purpose (owner decision, 2026-10-10), the
 *   links are included deliberately.
 * - **Disabled field.** The question input is disabled and labelled only through
 *   an `sr-only` span, exactly as the template's `clip`-hidden span does.
 * - **Escape.** A document keydown listener closes the open panel; it is only
 *   attached while open.
 *
 * The toggle keeps the template's `aria-label="Abrir ayuda"` in both states and
 * exposes the state through `aria-expanded`.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const TOGGLE_LABEL = "Abrir ayuda";

const QUICK_LINKS: readonly { readonly label: string; readonly href: string }[] = [
  { label: "¿Qué es el revenue share?", href: "/help" },
  { label: "¿Vaqcrow guarda mis fondos?", href: "/help" },
  { label: "¿Qué es real y qué es simulado?", href: "#limites" }
];

function QuickLink({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <Link
      href={href}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-control border border-border px-3 text-sm font-semibold text-text-primary no-underline hover:bg-surface ${FOCUS_RING}`}
    >
      {label}
      <IoChevronForwardOutline aria-hidden="true" focusable="false" className="text-base text-brand-accent-text" />
    </Link>
  );
}

function Panel({ onClose }: { readonly onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Asistente de ayuda"
      className="flex w-[340px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[20px] border border-border bg-raised text-text-primary shadow-[0_24px_48px_-12px_rgba(17,17,17,0.3)]"
    >
      <div className="flex items-center justify-between gap-2 bg-brand-accent px-4 py-[14px] text-on-accent">
        <div className="flex items-center gap-2.5">
          <span className="[&_[data-brand-isotipo]]:bg-on-accent">
            <BrandIsotipo />
          </span>
          <div>
            <div className="text-[15px] font-bold">Asistente de Vaqcrow</div>
            <div className="text-xs">Próximamente con respuestas de la documentación</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar asistente"
          className={`grid size-9 shrink-0 place-items-center rounded-control border-0 bg-transparent text-on-accent hover:bg-[rgba(255,255,255,0.16)] ${FOCUS_RING}`}
        >
          <IoCloseOutline aria-hidden="true" focusable="false" className="text-[22px]" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5 p-4">
        <div className="max-w-[90%] self-start rounded-[12px_12px_12px_4px] bg-surface px-3 py-2.5 text-sm leading-[1.5]">
          Hola. Todavía no estoy conectado, pero estas respuestas te pueden servir:
        </div>

        {QUICK_LINKS.map((link) => (
          <QuickLink key={link.label} label={link.label} href={link.href} />
        ))}

        <label className="mt-1 flex h-11 items-center gap-2 rounded-control border border-dashed border-control pr-1.5 pl-3">
          <span className="sr-only">Escribí tu pregunta</span>
          <input
            disabled
            placeholder="Escribir pregunta · próximamente"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text-secondary outline-none"
          />
          <IoSendOutline aria-hidden="true" focusable="false" className="text-lg text-text-secondary" />
        </label>

        <Link href="/help" className={`text-center text-[13px] font-semibold ${FOCUS_RING}`}>
          Ir al centro de ayuda
        </Link>
      </div>
    </div>
  );
}

export function HelpAssistant() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const ToggleIcon: IconType = isOpen ? IoCloseOutline : IoChatbubbleEllipsesOutline;

  return (
    <div className="fixed right-6 bottom-6 z-30 flex flex-col items-end gap-3">
      {isOpen ? <Panel onClose={() => setIsOpen(false)} /> : null}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={TOGGLE_LABEL}
        className={`flex h-14 items-center gap-2 rounded-pill bg-brand-accent pr-5 pl-4 text-[15px] font-[650] text-on-accent shadow-[0_12px_28px_-8px_rgba(138,5,190,0.55)] hover:bg-brand-accent-hover ${FOCUS_RING}`}
      >
        <ToggleIcon aria-hidden="true" focusable="false" className="text-[22px]" />
        Ayuda
      </button>
    </div>
  );
}
