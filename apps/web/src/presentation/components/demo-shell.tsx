"use client";

import type { ReactNode } from "react";
import { demoSteps } from "@/application/navigation/demo-steps";
import { journeyStepHref } from "@/application/navigation/journey-params";
import { microcopy } from "@/application/trust/disclosures";
import { useJourneyIds } from "@/state/journey-store-provider";
import { useDemoStep } from "@/state/use-demo-step";
import { AccountMenu } from "./account-menu";
import { DemoNavbar } from "./demo-navbar";
import { DemoProgress } from "./demo-progress";
import { DemoStepNav } from "./demo-step-nav";
import { SiteFooter } from "./site-footer";
import { ThemeSwitcher } from "./theme-switcher";

export interface DemoShellProps {
  readonly children: ReactNode;
}

/**
 * Shell copy decoded from `Vaqcrow Onboarding PyME.dc.html`
 * (`docs/design/template/`, git-ignored). The demo has no authentication, so the
 * navbar's actions slot shows a non-interactive identity instead of a session
 * menu: there is no person name and no "Cerrar sesión" in the corpus, and
 * `AccountMenu` renders identity only when its `items` list is empty. The demo
 * session is shown as the investor (the template's `userRole` is `INVERSOR`), so
 * the subtitle reads "Inversor". The footer legal row is the "Vaqcrow · 2026"
 * copyright line plus the canonical Testnet badge, never a retyped string.
 */
const DEMO_SESSION_NAME = "Sesión de demostración";
const DEMO_SESSION_SUBTITLE = "Inversor";
const DEMO_FOOTER_COPYRIGHT = "Vaqcrow · 2026";

export function DemoShell({ children }: DemoShellProps) {
  const demoStep = useDemoStep();
  const ids = useJourneyIds();

  const navItems = demoSteps.map((step) => ({
    label: step.label,
    href: journeyStepHref(step.slug, ids),
    // `exactOptionalPropertyTypes` forbids `current: undefined`, so the key is
    // only spread in when the step is active.
    ...(demoStep?.step.slug === step.slug ? { current: true } : {})
  }));

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <DemoNavbar
        items={navItems}
        actions={
          <>
            <ThemeSwitcher />
            <AccountMenu
              name={DEMO_SESSION_NAME}
              subtitle={DEMO_SESSION_SUBTITLE}
              items={[]}
            />
          </>
        }
      />
      {/*
        Template page geometry (`Vaqcrow Portafolio.dc.html` / `Vaqcrow
        Informes.dc.html` `<main>`): the desktop container is max-width 1264 px
        with 32 px lateral padding, the page title is 30 px / 700 / -0.02em
        (`<h1 style="margin:0;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-0.02em">`)
        and the step progress reads as its eyebrow. Every route renders inside
        this `<main>`, so all seven pages share the shell's container instead of
        running edge to edge.
      */}
      {demoStep ? (
        <main className="mx-auto flex w-full max-w-[1264px] flex-1 flex-col gap-6 px-8 py-10">
          <header className="flex flex-col gap-1.5">
            <DemoProgress step={demoStep.step} position={demoStep.position} total={demoStep.total} />
            <h1 className="m-0 text-[30px] leading-[1.2] font-bold tracking-[-0.02em]">
              {demoStep.step.label}
            </h1>
          </header>
          {children}
          <DemoStepNav previous={demoStep.previous} next={demoStep.next} />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-[1264px] flex-1 px-8 py-10">{children}</main>
      )}
      <SiteFooter copyright={DEMO_FOOTER_COPYRIGHT} environment={microcopy.testnetBadge} />
    </div>
  );
}
