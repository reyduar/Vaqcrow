"use client";

import type { ReactNode } from "react";
import { demoStepHref, demoSteps } from "@/application/navigation/demo-steps";
import { microcopy } from "@/application/trust/disclosures";
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
 * `AccountMenu` renders identity only when its `items` list is empty. The footer
 * legal row is the template's "Trabajo Fin de Máster" line plus the canonical
 * Testnet badge, never a retyped string.
 */
const DEMO_SESSION_NAME = "Sesión de demostración";
const DEMO_SESSION_SUBTITLE = "PyME";
const DEMO_FOOTER_COPYRIGHT = "Vaqcrow · Trabajo Fin de Máster · 2026";

export function DemoShell({ children }: DemoShellProps) {
  const demoStep = useDemoStep();

  const navItems = demoSteps.map((step) => ({
    label: step.label,
    href: demoStepHref(step.slug),
    // `exactOptionalPropertyTypes` forbids `current: undefined`, so the key is
    // only spread in when the step is active.
    ...(demoStep?.step.slug === step.slug ? { current: true } : {})
  }));

  return (
    <div>
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
      {demoStep ? (
        <>
          <h1>{demoStep.step.label}</h1>
          <DemoProgress step={demoStep.step} position={demoStep.position} total={demoStep.total} />
        </>
      ) : null}
      {children}
      {demoStep ? <DemoStepNav previous={demoStep.previous} next={demoStep.next} /> : null}
      <SiteFooter copyright={DEMO_FOOTER_COPYRIGHT} environment={microcopy.testnetBadge} />
    </div>
  );
}
