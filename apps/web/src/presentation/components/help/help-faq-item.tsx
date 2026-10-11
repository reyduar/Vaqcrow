"use client";

import type { HelpFaq } from "@/application/help/faq";
import { HELP_ICONS } from "./help-icons";

/**
 * One FAQ disclosure row (`Vaqcrow Ayuda.dc.html` `:124-129`). The template has
 * no HeroUI Accordion, so this is the disclosure pattern it draws by hand: a
 * `<button>` carrying `aria-expanded` and `aria-controls` over the answer
 * region it owns. The answer stays mounted and is toggled with the native
 * `hidden` attribute, so `aria-controls` always resolves to a real element.
 * The owner decision keeps the template's single-open behaviour in
 * `HelpExplorer`; this row only reports whether it is the open one.
 */
export interface HelpFaqItemProps {
  readonly faq: HelpFaq;
  readonly open: boolean;
  readonly onToggle: () => void;
}

export function HelpFaqItem({ faq, open, onToggle }: HelpFaqItemProps) {
  const panelId = `faq-panel-${faq.id}`;
  const ToggleIcon = open ? HELP_ICONS["remove-outline"] : HELP_ICONS["add-outline"];

  return (
    <div
      className={`overflow-hidden rounded-card border ${
        open ? "border-brand-accent-text bg-raised" : "border-transparent bg-surface"
      }`}
    >
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-[60px] w-full items-center justify-between gap-4 bg-transparent px-[18px] py-3.5 text-left text-base font-[650] text-text-primary"
        >
          <span>{faq.question}</span>
          <ToggleIcon aria-hidden="true" focusable="false" className="shrink-0 text-[20px] text-brand-accent-text" />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="px-[18px] pb-[18px] text-[15px] leading-[1.6] text-text-secondary">
        {faq.answer}
      </div>
    </div>
  );
}
