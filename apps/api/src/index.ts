import { parseFundingIntentId } from "@vaqcrow/contracts";
import { parseApiConfig } from "./application/config/api-config.js";
import { DEFAULT_CONFIRMATION_POLICY } from "./application/use-cases/confirm-funding-intents.js";
import { StellarFundingIntentXdr } from "./infrastructure/adapters/stellar-funding-intent-xdr.js";
import { StellarLedger } from "./infrastructure/adapters/stellar-ledger.js";
import { StellarTransaction } from "./infrastructure/adapters/stellar-transaction.js";
import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { SupabaseFundingIntentRepository } from "./infrastructure/adapters/supabase-funding-intent-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { ConfirmationScheduler } from "./infrastructure/scheduling/confirmation-scheduler.js";
import { createSupabaseClient } from "./infrastructure/supabase/create-supabase-client.js";

// Fail fast and clearly: a missing or out-of-scope value stops the process here
// with every offending key listed, rather than surfacing at the first request.
const config = parseApiConfig(process.env);

// One client, shared by every repository: the process holds a single
// connection pool, not one per adapter.
const supabase = createSupabaseClient(config.supabase);

const applicationReviewRepository = new SupabaseApplicationReviewRepository(supabase);
const fundingIntentRepository = new SupabaseFundingIntentRepository(supabase);

const app = buildApp({
  applicationReviewRepository,
  fundingIntent: {
    ledger: new StellarLedger(config.stellar),
    xdr: new StellarFundingIntentXdr(),
    repository: fundingIntentRepository,
    // The API carries the network identity (`D1`): the web never holds its own
    // copy of the passphrase, so it is passed explicitly to the use case.
    network: {
      network: config.stellar.network,
      networkPassphrase: config.stellar.networkPassphrase
    },
    generateIntentId: () => parseFundingIntentId(crypto.randomUUID())
  }
});

/**
 * The confirmation poll, in this process on purpose (`D1`).
 *
 * `DEMO.md` line 150 makes an `apps/worker` conditional on the bounded
 * confirmations not fitting safely here, and line 318 lists it as cut work when
 * they do. They do: the loop holds no state — the schedule is `next_attempt_at`
 * in the database — so a restart resumes rather than restarts, and a separate
 * workspace would buy isolation rather than capability.
 */
const confirmation = new ConfirmationScheduler(
  {
    repository: fundingIntentRepository,
    transaction: new StellarTransaction(config.stellar)
  },
  {
    policy: DEFAULT_CONFIRMATION_POLICY,
    onStep: (result) => {
      if (!result.ok) {
        // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
        console.error("[confirmation] the pending read failed", { code: result.error.code });
        return;
      }

      // Only terminal outcomes are worth a line. An empty tick every five seconds
      // would drown the timeline the demo's narrative depends on, and a deferred
      // intent is the normal case rather than news.
      const terminal = result.value.filter(
        (step) => step.result === "confirmed" || step.result === "failed"
      );

      if (terminal.length > 0) {
        // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
        console.log("[confirmation] terminal outcomes", terminal);
      }
    },
    onError: (error) => {
      // eslint-disable-next-line no-console -- internal diagnostics only; never returned to a caller
      console.error("[confirmation] tick failed", error);
    }
  }
);

confirmation.start();

await app.listen({ port: config.port, host: "0.0.0.0" });

// Stop the loop before closing the server, so a tick in flight finishes its write
// instead of being cut off mid-transition. The order matters: a confirmation the
// database never accepted is one the next process would have to re-derive.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await confirmation.stop();
      await app.close();
      process.exit(0);
    })();
  });
}
