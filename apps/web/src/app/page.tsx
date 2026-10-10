import { AppShell } from "@/presentation/components/app-shell";

/**
 * `/` — landing skeleton: the role-aware shell only. The landing content is
 * #418; nothing beyond the shell is invented here. The heading is visually
 * hidden so the page still has an accessible title.
 */
export default function Home() {
  return (
    <AppShell>
      <h1 className="sr-only">Vaqcrow</h1>
    </AppShell>
  );
}
