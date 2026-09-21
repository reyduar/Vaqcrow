import { generateCorrelationId } from "@vaqcrow/contracts";
import { describe, expect, it } from "vitest";
import { SupabaseFundingIntentRepository } from "../../src/infrastructure/adapters/supabase-funding-intent-repository.js";
import {
  getPublishableClient,
  getServiceRoleClient,
  hasIntegrationCredentials
} from "./support/integration-clients.js";
import { syntheticFundingIntentId } from "./support/synthetic-id.js";

/**
 * Live coverage for `funding_intent`'s access control and constraints, against
 * the real Supabase/PostgREST instance. Credential-gated: skips entirely (not
 * fails) when the three Supabase variables are absent.
 *
 * WHY THERE IS NO WRITE-PATH SUITE HERE
 *
 * The write path — insert round-trip, exact replay, idempotency conflicts,
 * `findById` on a persisted row, the `updated_at` trigger and the D10 cascade —
 * has no repeatable suite, and cannot have one, because a row written here
 * could never be removed:
 *
 *   - `funding_intent` is append-only for the API role. The migration
 *     `20260920120000_create_funding_intent.sql` ends with
 *     `revoke all on public.funding_intent from service_role;` followed by
 *     `grant select, insert on public.funding_intent to service_role;`, so
 *     `service_role` holds neither DELETE nor UPDATE.
 *   - Its application FK is `on delete set null`, not `on delete cascade`, so
 *     deleting the parent does not remove the row either. That is design D10,
 *     and it is deliberate: a funding record is financial evidence in its own
 *     right and must outlive the application it references — and under D4 it
 *     may reference none at all.
 *
 * Both are design decisions, not oversights. The suite bends to the design:
 * granting `service_role` DELETE or UPDATE to make cleanup convenient would
 * contradict the repository's own immutability practice (see
 * `20260919203900_enforce_human_decision_grant_immutability.sql`) and D10's
 * rationale. Everything kept below is therefore residue-free — every write it
 * attempts is refused by a grant or a CHECK, so nothing is ever persisted and
 * no cleanup is owed.
 *
 * WHAT IS ALREADY LIVE-VERIFIED OUTSIDE THIS SUITE
 *
 * On 2026-09-21 the funding-intent persistence layer was verified by direct
 * query against the live project, before this Task: the migration's structure,
 * its grants, and its own idempotency (re-running the SQL left every count
 * unchanged). A rolled-back block proved every constraint bites, and PostgREST's
 * decimal-string-to-`bigint` coercion was confirmed the same way (advisory A2).
 * Those were one-shot operational checks, not a repeatable suite.
 *
 * The probes below are the part of that work that can be repeatable, and they
 * were added when #25's own migration landed: the confirmation columns exist, the
 * three new CHECKs bite in both directions, and the column-scoped UPDATE grant
 * lets the API move `state` while refusing to rewrite the financial evidence.
 * Everything here is residue-free by construction — a refused write persists
 * nothing, and a privilege check runs before row matching, so a non-existent id
 * still exercises the grant.
 */

const FUNDING_INTENT_TABLE = "funding_intent";

const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SYNTHETIC_SOURCE = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const SYNTHETIC_DESTINATION = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const EXPIRES_AT = "2026-09-21T12:15:00.000Z";
const SIGNED_XDR = "AAAAAgAAAABsynthetic-signed-envelope";

function repository(): SupabaseFundingIntentRepository {
  return new SupabaseFundingIntentRepository(getServiceRoleClient());
}

/** A complete row for the raw service-role inserts the CHECK constraints need. */
function rawFundingRow(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    intent_id: syntheticFundingIntentId(),
    state: "submitted",
    network: "testnet",
    network_passphrase: NETWORK_PASSPHRASE,
    source_account_id: SYNTHETIC_SOURCE,
    source_sequence: "1099511627778",
    destination_account_id: SYNTHETIC_DESTINATION,
    amount_stroops: "10000000",
    memo: null,
    expires_at: EXPIRES_AT,
    signed_xdr: SIGNED_XDR,
    transaction_hash: "f".repeat(64),
    application_id: null,
    last_correlation_id: generateCorrelationId(),
    ...overrides
  };
}

describe.skipIf(!hasIntegrationCredentials())("funding intent persistence (live integration)", () => {
  it("denies a publishable-key client select and insert with 42501", async () => {
    const publishable = getPublishableClient();

    const selected = await publishable.from(FUNDING_INTENT_TABLE).select().limit(1);
    expect(selected.error?.code).toBe("42501");
    expect(selected.data).toBeNull();

    const inserted = await publishable.from(FUNDING_INTENT_TABLE).insert(rawFundingRow());
    expect(inserted.error?.code).toBe("42501");
  });

  it("refuses a state outside the demo's vocabulary at the CHECK constraint", async () => {
    const intentId = syntheticFundingIntentId();

    // `manual_review` is the production-roadmap state product.md §8.1 names, and
    // it stays outside the vocabulary #25 admits. `confirmed` was this fixture's
    // invalid value until #25 made it a real state; using it now would still be
    // refused, but by the terminal-evidence CHECK rather than the vocabulary one,
    // so the assertion would pass while testing something else.
    const refused = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .insert(rawFundingRow({ intent_id: intentId, state: "manual_review" }));

    expect(refused.status).toBe(400);
    expect(refused.error?.code).toBe("23514");

    const residue = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .select("intent_id")
      .eq("intent_id", intentId);
    expect(residue.data).toEqual([]);
  });

  it("refuses a zero amount at the CHECK constraint", async () => {
    const intentId = syntheticFundingIntentId();

    const refused = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .insert(rawFundingRow({ intent_id: intentId, amount_stroops: "0" }));

    expect(refused.status).toBe(400);
    expect(refused.error?.code).toBe("23514");

    const residue = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .select("intent_id")
      .eq("intent_id", intentId);
    expect(residue.data).toEqual([]);
  });

  it("exposes the confirmation columns #25 added", async () => {
    const { data, error } = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .select("confirmation_attempts, next_attempt_at, confirmed_at, ledger_sequence, failure_reason")
      .limit(1);

    // PostgREST answers a missing column with 42703, so an empty list and no error
    // is the residue-free way to assert the shape: it proves the columns exist
    // without needing a row to read.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses a confirmed state without its ledger evidence", async () => {
    const intentId = syntheticFundingIntentId();

    const refused = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .insert(rawFundingRow({ intent_id: intentId, state: "confirmed" }));

    expect(refused.status).toBe(400);
    expect(refused.error?.code).toBe("23514");
    expect(refused.error?.message).toContain("funding_intent_confirmed_evidence_check");

    const residue = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .select("intent_id")
      .eq("intent_id", intentId);
    expect(residue.data).toEqual([]);
  });

  it("refuses a submitted state that carries confirmed evidence", async () => {
    const intentId = syntheticFundingIntentId();

    // The equivalence form, in the direction a one-directional CHECK would have
    // missed: a non-terminal row holding evidence for a state it is not in is
    // incoherent rather than merely untidy.
    const refused = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .insert(
        rawFundingRow({
          intent_id: intentId,
          state: "submitted",
          confirmed_at: EXPIRES_AT,
          ledger_sequence: 1234567
        })
      );

    expect(refused.status).toBe(400);
    expect(refused.error?.code).toBe("23514");
    expect(refused.error?.message).toContain("funding_intent_confirmed_evidence_check");
  });

  it("refuses a failed state without a reason", async () => {
    const intentId = syntheticFundingIntentId();

    const refused = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .insert(rawFundingRow({ intent_id: intentId, state: "failed" }));

    expect(refused.status).toBe(400);
    expect(refused.error?.code).toBe("23514");
    expect(refused.error?.message).toContain("funding_intent_failed_evidence_check");
  });

  it("refuses a negative confirmation attempt count", async () => {
    const intentId = syntheticFundingIntentId();

    const refused = await getServiceRoleClient()
      .from(FUNDING_INTENT_TABLE)
      .insert(rawFundingRow({ intent_id: intentId, confirmation_attempts: -1 }));

    expect(refused.status).toBe(400);
    expect(refused.error?.code).toBe("23514");
    expect(refused.error?.message).toContain("funding_intent_attempts_check");
  });

  it("lets the API move the state while refusing to rewrite the financial evidence", async () => {
    const unknown = syntheticFundingIntentId();
    const client = getServiceRoleClient();

    // A privilege check runs before row matching, so a non-existent id still
    // exercises the grant and leaves nothing behind. This is the behavioural form
    // of the column-scoped grant — stronger than reading the catalogue, because it
    // is PostgREST's own enforcement that answers.
    const financial = await client
      .from(FUNDING_INTENT_TABLE)
      .update({ amount_stroops: 1 })
      .eq("intent_id", unknown);

    expect(financial.error?.code).toBe("42501");

    const transition = await client
      .from(FUNDING_INTENT_TABLE)
      .update({ state: "submitted", confirmation_attempts: 0 })
      .eq("intent_id", unknown);

    expect(transition.error).toBeNull();
  });

  it("reports not_found for an unknown intent id", async () => {
    const result = await repository().findById(syntheticFundingIntentId());

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });
});
