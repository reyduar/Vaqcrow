import { parseFundingIntentId } from "@vaqcrow/contracts";
import { parseApiConfig } from "./application/config/api-config.js";
import { StellarFundingIntentXdr } from "./infrastructure/adapters/stellar-funding-intent-xdr.js";
import { StellarLedger } from "./infrastructure/adapters/stellar-ledger.js";
import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { SupabaseFundingIntentRepository } from "./infrastructure/adapters/supabase-funding-intent-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { createSupabaseClient } from "./infrastructure/supabase/create-supabase-client.js";

// Fail fast and clearly: a missing or out-of-scope value stops the process here
// with every offending key listed, rather than surfacing at the first request.
const config = parseApiConfig(process.env);

// One client, shared by every repository: the process holds a single
// connection pool, not one per adapter.
const supabase = createSupabaseClient(config.supabase);

const applicationReviewRepository = new SupabaseApplicationReviewRepository(supabase);
const app = buildApp({
  applicationReviewRepository,
  fundingIntent: {
    ledger: new StellarLedger(config.stellar),
    xdr: new StellarFundingIntentXdr(),
    repository: new SupabaseFundingIntentRepository(supabase),
    // The API carries the network identity (`D1`): the web never holds its own
    // copy of the passphrase, so it is passed explicitly to the use case.
    network: {
      network: config.stellar.network,
      networkPassphrase: config.stellar.networkPassphrase
    },
    generateIntentId: () => parseFundingIntentId(crypto.randomUUID())
  }
});
await app.listen({ port: config.port, host: "0.0.0.0" });
