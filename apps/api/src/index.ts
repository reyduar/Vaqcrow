import { createOpenCodeGoProvider } from "@vaqcrow/ai";
import { parseApiConfig } from "./application/config/api-config.js";
import { buildCampaignDependencies } from "./infrastructure/campaign-dependencies.js";
import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { createSupabaseClient } from "./infrastructure/supabase/create-supabase-client.js";

// Fail fast and clearly: a missing or out-of-scope value stops the process here
// with every offending key listed, rather than surfacing at the first request.
const config = parseApiConfig(process.env);

// One client, shared by every repository: the process holds a single
// connection pool, not one per adapter.
const supabase = createSupabaseClient(config.supabase);

const applicationReviewRepository = new SupabaseApplicationReviewRepository(supabase);

/**
 * The composition root is the one place the credential is unwrapped.
 *
 * `config.llm.apiKey` is a `Secret` that collapses to a marker under string
 * coercion, so it cannot reach a log line by accident; `reveal()` is greppable
 * in review, and this call site is the only one. The adapter receives a plain
 * string and never returns it.
 */
const assessmentProvider = createOpenCodeGoProvider({
  baseUrl: config.llm.baseUrl,
  model: config.llm.model,
  apiKey: config.llm.apiKey.reveal(),
  timeoutMs: config.llm.timeoutMs
});

const campaign = buildCampaignDependencies(config, {
  supabase,
  applicationReviews: applicationReviewRepository
});

const app = buildApp({
  applicationReviewRepository,
  assessment: {
    provider: assessmentProvider,
    timeoutMs: config.llm.timeoutMs
  },
  campaign,
  cors: config.cors
});

await app.listen({ port: config.port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await app.close();
      process.exit(0);
    })();
  });
}
