import type { ReactNode } from "react";
import { DemoShell } from "@/presentation/components/demo-shell";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoShell>{children}</DemoShell>;
}
