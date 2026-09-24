import { createHash, randomUUID } from "node:crypto";
import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type { CampaignFactoryPort } from "../ports/campaign-factory-port.js";
import type { CampaignVaultChainPort, VaultChainState } from "../ports/campaign-vault-chain-port.js";
import { mapVaultStateToCampaignState } from "../ports/campaign-vault-chain-port.js";
import type { CampaignRecord, CampaignRepositoryPort } from "../ports/campaign-repository-port.js";
import type { StellarAccountPort } from "../ports/stellar-account-port.js";

/**
 * Opens the campaign vault after human approval (D5 in
 * `odd/tasks/campaign-vault-web-journey.md`): verifies/funds the SME's own
 * account (D2), deploys the vault through the factory (owned by the
 * platform, signed with `PlatformSigner`, D8), reads the deployment back
 * from the chain, and mirrors only what the chain reported.
 *
 * `node:crypto` is used directly rather than through an injected hasher
 * port: it is a Node core module, not an npm dependency, so
 * `api-application-stays-provider-free` in `.dependency-cruiser.cjs` — which
 * forbids `fastify`/`@supabase`/`@stellar`/provider SDKs under
 * `application/` — does not reach it.
 */

/**
 * What the platform funds the SME's account with when it does not exist yet
 * (D2, `docs/planning/stellar-blockchain-requirements.md` "Provisión de la
 * cuenta de la PyME"). 2 XLM: comfortably above the base reserve plus the
 * fees the contribute/withdraw/refund/payout operations this demo issues
 * against the account will cost, without funding it for any purpose beyond
 * existing and receiving.
 */
export const SME_STARTING_BALANCE_STROOPS = 20_000_000n;

export interface OpenCampaignCommand {
  readonly applicationId: ApplicationId;
  readonly smeAccountId: string;
  readonly goalStroops: bigint;
  readonly deadline: Date;
}

export type OpenCampaignErrorCode =
  | "application_not_found"
  | "application_not_approved"
  | "sme_account_unavailable"
  | "vault_state_mismatch"
  | "unavailable";

export interface OpenCampaignError {
  readonly code: OpenCampaignErrorCode;
}

export type OpenCampaignResult =
  | { readonly ok: true; readonly value: { readonly campaign: CampaignRecord; readonly applied: boolean } }
  | { readonly ok: false; readonly error: OpenCampaignError };

export interface OpenCampaignDependencies {
  readonly applicationReviews: ApplicationReviewRepositoryPort;
  readonly campaigns: CampaignRepositoryPort;
  readonly accounts: StellarAccountPort;
  readonly factory: CampaignFactoryPort;
  readonly chain: CampaignVaultChainPort;
  readonly network: string;
  /** The vault's payment asset (native XLM SAC in this demo). Config-level, not per-application. */
  readonly tokenContractId: string;
}

export async function openCampaign(
  deps: OpenCampaignDependencies,
  input: { readonly command: OpenCampaignCommand; readonly correlationId: CorrelationId }
): Promise<OpenCampaignResult> {
  const { command, correlationId } = input;

  const application = await deps.applicationReviews.findById(command.applicationId);

  if (!application.ok) {
    return {
      ok: false,
      error: { code: application.error.code === "not_found" ? "application_not_found" : "unavailable" }
    };
  }

  if (application.value.state !== "approved") {
    return { ok: false, error: { code: "application_not_approved" } };
  }

  const salt = deriveSalt(command.applicationId);

  // Predicted before the replay check, not only before `deploy`: the
  // deployed address is deterministic per `(factory, salt)`, so this is the
  // same address a mirrored campaign for this application would already
  // carry — computing it here keeps the two paths (replay vs. deploy)
  // sharing one derivation instead of two.
  const predicted = await deps.factory.predict(salt);
  if (!predicted.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  const existing = await deps.campaigns.findByApplicationId(command.applicationId);

  if (existing.ok) {
    return { ok: true, value: { campaign: existing.value, applied: false } };
  }

  if (existing.error.code !== "not_found") {
    return { ok: false, error: { code: "unavailable" } };
  }

  // A previous attempt may have deployed on-chain and failed afterwards (a
  // poll timeout, a chain read, the mirror write). The mirror then has no
  // row, but the vault already lives at the predicted address, and a second
  // `deploy` with the same salt can never succeed. So the chain is probed
  // first: an existing vault is adopted, only `not_found` leads to a deploy,
  // and any other answer stops here rather than risk a blind deploy.
  const probe = await deps.chain.readCampaign(predicted.value);

  if (!probe.ok && probe.error.code !== "not_found") {
    return { ok: false, error: { code: "unavailable" } };
  }

  let contractAddress = predicted.value;

  if (!probe.ok) {
    const accountReady = await ensureSmeAccount(deps.accounts, command.smeAccountId);
    if (!accountReady) {
      return { ok: false, error: { code: "sme_account_unavailable" } };
    }

    const deployed = await deps.factory.deploy({
      salt,
      smeAccountId: command.smeAccountId,
      tokenContractId: deps.tokenContractId,
      goalStroops: command.goalStroops,
      deadline: command.deadline
    });

    if (!deployed.ok) {
      return { ok: false, error: { code: "unavailable" } };
    }

    contractAddress = deployed.value.contractAddress;
  }

  const chainState = await deps.chain.readCampaign(contractAddress);
  if (!chainState.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  if (!matchesRequestedVault(chainState.value, command, deps.tokenContractId)) {
    return { ok: false, error: { code: "vault_state_mismatch" } };
  }

  const created = await deps.campaigns.create({
    campaign: {
      campaignId: randomUUID(),
      applicationId: command.applicationId,
      smeAccountId: command.smeAccountId,
      contractAddress,
      network: deps.network,
      tokenContractAddress: deps.tokenContractId,
      goalStroops: chainState.value.goalStroops,
      deadline: command.deadline.toISOString(),
      state: mapVaultStateToCampaignState(chainState.value.state),
      totalStroops: chainState.value.totalStroops,
      reconciliationStatus: "in_sync",
      lastReconciledAt: chainState.value.observedAt.toISOString()
    },
    correlationId
  });

  if (!created.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  return { ok: true, value: { campaign: created.value, applied: true } };
}

/**
 * Idempotent per application (D5): `SHA-256(applicationId)` is the same
 * 32-byte input `factory.predict`/`factory.deploy` build a `BytesN<32>`
 * argument from every time this application opens its vault, so a retry
 * after a partial failure probes the same deterministic address and adopts
 * the vault already deployed there instead of attempting a second deploy.
 */
function deriveSalt(applicationId: ApplicationId): Uint8Array {
  return new Uint8Array(createHash("sha256").update(applicationId).digest());
}

/**
 * The precondition the vault's own doc requires (`contracts/campaign-vault/src/lib.rs`,
 * "off-chain precondition"): the SME's account must exist and be able to
 * receive before the vault opens. `accountExists` is checked again after
 * `createAccount`, rather than trusted from its own outcome, because the
 * fact the use case actually needs — the account exists on the ledger — is
 * exactly what `accountExists` reports, and re-reading the ledger is what
 * proves the funding transaction actually settled, not merely that
 * `createAccount` returned a hash.
 */
async function ensureSmeAccount(accounts: StellarAccountPort, smeAccountId: string): Promise<boolean> {
  const exists = await accounts.accountExists(smeAccountId);
  if (!exists.ok) return false;
  if (exists.value) return true;

  const created = await accounts.createAccount({
    destination: smeAccountId,
    startingBalanceStroops: SME_STARTING_BALANCE_STROOPS
  });
  if (!created.ok) return false;

  const recheck = await accounts.accountExists(smeAccountId);
  return recheck.ok && recheck.value;
}

/**
 * Sanity check against a chain read that came back inconsistent with what
 * was just requested — the contract's own constructor would have refused
 * an invalid goal/deadline (`InvalidGoal`/`InvalidDeadline`), so this is a
 * defence against a wrong deployment being mirrored, not a check the demo
 * expects to fail in the happy path.
 */
function matchesRequestedVault(
  state: VaultChainState,
  command: OpenCampaignCommand,
  tokenContractId: string
): boolean {
  return (
    state.state === "funding" &&
    state.goalStroops === command.goalStroops &&
    state.smeAccountId === command.smeAccountId &&
    state.tokenContractId === tokenContractId &&
    state.deadline.getTime() === command.deadline.getTime()
  );
}
