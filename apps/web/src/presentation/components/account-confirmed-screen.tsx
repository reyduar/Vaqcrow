import Link from "next/link";
import { IoAlertCircleOutline, IoArrowForwardOutline, IoCheckmarkCircleOutline } from "react-icons/io5";
import { ACCOUNT_CONFIRMED_COPY } from "@/application/auth/account-confirmed";
import { AppShell } from "./app-shell";
import { FOCUS_RING } from "./auth-field";

/**
 * The email-confirmation landing (#556). The template does not design it, so
 * it reuses the success/critical surfaces and the primary button of the
 * «Cuenta creada» view. It never shows the email.
 */
export function AccountConfirmedScreen({ failed }: { readonly failed: boolean }) {
  const copy = failed ? ACCOUNT_CONFIRMED_COPY.failed : ACCOUNT_CONFIRMED_COPY.confirmed;
  const Icon = failed ? IoAlertCircleOutline : IoCheckmarkCircleOutline;
  return (
    <AppShell>
      <section className="mx-auto flex max-w-xl flex-col items-start gap-6 py-16">
        <Icon
          aria-hidden="true"
          focusable="false"
          className={`text-5xl ${failed ? "text-trust-critical" : "text-trust-success"}`}
        />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[clamp(30px,3vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]">
            {copy.title}
          </h1>
          <p className="m-0 text-base text-pretty text-text-secondary">{copy.body}</p>
        </div>
        <Link
          href="/login"
          className={`flex h-[52px] items-center justify-center gap-2 rounded-control bg-brand-accent px-[18px] text-base font-[650] text-on-accent no-underline transition-colors duration-150 hover:bg-brand-accent-hover motion-reduce:transition-none ${FOCUS_RING}`}
        >
          {ACCOUNT_CONFIRMED_COPY.login}
          <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-lg" />
        </Link>
      </section>
    </AppShell>
  );
}
