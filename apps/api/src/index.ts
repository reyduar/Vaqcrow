import { parseApiConfig } from "./application/config/api-config.js";
import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { createSupabaseClient } from "./infrastructure/supabase/create-supabase-client.js";

// Fail fast and clearly: a missing or out-of-scope value stops the process here
// with every offending key listed, rather than surfacing at the first request.
const config = parseApiConfig(process.env);

const applicationReviewRepository = new SupabaseApplicationReviewRepository(
  createSupabaseClient(config.supabase)
);
const app = buildApp({ applicationReviewRepository });
await app.listen({ port: config.port, host: "0.0.0.0" });
