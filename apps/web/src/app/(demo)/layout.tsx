import type { ReactNode } from "react";
import { DemoShell } from "@/presentation/components/demo-shell";
import { JourneyStoreProvider } from "@/state/journey-store-provider";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <JourneyStoreProvider>
      <DemoShell>{children}</DemoShell>
    </JourneyStoreProvider>
  );
}
