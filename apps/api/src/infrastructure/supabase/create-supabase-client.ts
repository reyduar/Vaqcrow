import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`${key} is required to create the Supabase client`);
  }

  return value;
}

export function createSupabaseClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const supabaseUrl = requireEnv(env, "SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
}

export function createPublishableSupabaseClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const supabaseUrl = requireEnv(env, "SUPABASE_URL");
  const supabasePublishableKey = requireEnv(env, "SUPABASE_PUBLISHABLE_KEY");

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false }
  });
}
