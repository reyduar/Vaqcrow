import type { ReactNode } from "react";
import { DemoShell } from "@/presentation/components/demo-shell";
import { DemoJourney } from "@/state/demo-journey";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoJourney>
      <DemoShell>{children}</DemoShell>
    </DemoJourney>
  );
}
