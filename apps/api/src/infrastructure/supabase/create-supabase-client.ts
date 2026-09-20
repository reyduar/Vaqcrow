import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ConfigurationError } from "../../application/config/config-issue.js";
import { missingIssue } from "../../application/config/env-source.js";
import type { SupabaseConfig } from "../../application/config/supabase-config.js";

/**
 * The adapter receives an already-validated configuration, never raw
 * `process.env`: parsing lives in `application/config`, so a credential cannot
 * reach `createClient` without having crossed the `Secret` boundary first.
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey.reveal(), {
    auth: { persistSession: false }
  });
}

export function createPublishableSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (config.publishableKey === undefined) {
    throw new ConfigurationError("Supabase publishable configuration", [
      missingIssue("SUPABASE_PUBLISHABLE_KEY")
    ]);
  }

  return createClient(config.url, config.publishableKey.reveal(), {
    auth: { persistSession: false }
  });
}
