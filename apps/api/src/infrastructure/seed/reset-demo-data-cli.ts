// Entry for `RESET_DEMO_DATA_CONFIRM=yes pnpm --filter @vaqcrow/api
// reset:demo-data:docker|cloud`. Thin on purpose: the logic and its tests live
// in reset-demo-data.ts. Never imported by index.ts, so the reset cannot run at
// API startup.
import { createClient } from "@supabase/supabase-js";
import { runResetDemoData } from "./reset-demo-data.js";
import type { ResetClient } from "./reset-demo-data.js";

const code = await runResetDemoData({
  env: process.env,
  createClient: (url, key) =>
    createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) as unknown as ResetClient,
  // eslint-disable-next-line no-console -- CLI output; never carries a secret
  print: (line) => console.log(line)
});

process.exit(code);
