import Link from "next/link";
import { HELP_COPY } from "@/application/help/faq";
import { HELP_ICONS } from "./help-icons";

/**
 * The help center's closing contact band (`Vaqcrow Ayuda.dc.html` `:132-135`):
 * the accent panel with the title, the body and the two links. Both labels and
 * both hrefs come from `HELP_COPY.contact` — the template's `.demo` mailto was
 * replaced by the owner's real address in WU1. The guide link is an app route
 * and goes through `next/link`; the email is a `mailto:` and stays an anchor.
 */
export function HelpContact() {
  const MailIcon = HELP_ICONS["mail-outline"];

  return (
    <section className="flex flex-wrap items-center justify-between gap-6 rounded-panel bg-brand-accent p-10 text-on-accent">
      <div className="flex max-w-[48ch] flex-col gap-2">
        <h2 className="m-0 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">{HELP_COPY.contact.title}</h2>
        <p className="m-0 text-base leading-[1.55]">{HELP_COPY.contact.body}</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <a
          href={HELP_COPY.contact.email.href}
          className="inline-flex h-12 items-center gap-2 rounded-control bg-canvas px-5 text-[15px] font-semibold text-text-primary no-underline transition-colors hover:bg-brand-accent-tint"
        >
          <MailIcon aria-hidden="true" focusable="false" className="text-[18px]" />
          {HELP_COPY.contact.email.label}
        </a>
        <Link
          href={HELP_COPY.contact.guide.href}
          className="inline-flex h-12 items-center rounded-control border border-on-accent px-5 text-[15px] font-semibold text-on-accent no-underline transition-colors hover:bg-on-accent/10"
        >
          {HELP_COPY.contact.guide.label}
        </Link>
      </div>
    </section>
  );
}
