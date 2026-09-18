import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const supabaseUrl = env["SUPABASE_URL"];
  const supabaseServiceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required to create the Supabase client");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to create the Supabase client");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
}
