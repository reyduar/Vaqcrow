import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { createSupabaseClient } from "./infrastructure/supabase/create-supabase-client.js";

const applicationReviewRepository = new SupabaseApplicationReviewRepository(createSupabaseClient());
const app = buildApp({ applicationReviewRepository });
await app.listen({ port: Number(process.env["PORT"] ?? 3000), host: "0.0.0.0" });
