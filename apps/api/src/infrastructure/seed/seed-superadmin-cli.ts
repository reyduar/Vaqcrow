// Entry for `pnpm --filter @vaqcrow/api seed:superadmin:docker|cloud`. Thin on
// purpose: the logic and its tests live in seed-superadmin.ts. Never imported
// by index.ts, so the seed cannot run at API startup.
import { createClient } from "@supabase/supabase-js";
import { runSeedSuperAdmin } from "./seed-superadmin.js";
import type { SeedClient } from "./seed-superadmin.js";

const code = await runSeedSuperAdmin({
  env: process.env,
  createClient: (url, key) =>
    createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) as unknown as SeedClient,
  // eslint-disable-next-line no-console -- CLI output; never carries a secret
  print: (line) => console.log(line)
});

process.exit(code);
