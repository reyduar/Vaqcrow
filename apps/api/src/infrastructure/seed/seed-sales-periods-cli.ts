// Entry for `pnpm --filter @vaqcrow/api seed:sales-periods:docker|cloud`. Thin
// on purpose: the logic lives in seed-sales-periods.ts. Never imported by
// index.ts, so the backfill cannot run at API startup.
import { createSimulatedSalesDataProvider } from "../adapters/simulated-sales-data-provider.js";
import { runSeedSalesPeriods } from "./seed-sales-periods.js";

const code = await runSeedSalesPeriods({
  env: process.env,
  provider: createSimulatedSalesDataProvider(),
  // eslint-disable-next-line no-console -- CLI output; never carries a secret
  print: (line) => console.log(line)
});

process.exit(code);
