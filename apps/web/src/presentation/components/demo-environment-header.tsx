import { microcopy } from "@/application/trust/disclosures";
import { Badge } from "./badge";
import { ThemeSwitcher } from "./theme-switcher";

/**
 * DemoEnvironmentHeader (Feature #17 / Task #53): persistent environment
 * chrome — brand + `DEMO` + `TESTNET` badges, plus the `Claro` / `Oscuro` /
 * `Sistema` theme selector the design corpus places under "Acceso secundario"
 * — rendered by `DemoShell` above its `demoStep` early-return branch so it
 * stays visible on every route, including `loading.tsx`/`error.tsx` states
 * (both nest inside `(demo)/layout.tsx`, per design's "DemoShell Chrome
 * Integration"). Pure presentational apart from the switcher's own state.
 */
export function DemoEnvironmentHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
      <span className="font-semibold">Vaqcrow</span>
      <div className="flex items-center gap-4">
        <Badge variant="demo" label="DEMO" />
        <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
