import { Address, BASE_FEE, Contract, FeeBumpTransaction, Keypair, TransactionBuilder, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import type { Account, Transaction, xdr } from "@stellar/stellar-sdk";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import type {
  CampaignVaultInvocationPort,
  CampaignVaultInvocationRefusalCode,
  CampaignVaultInvocationResult,
  CampaignVaultInvocationVerification,
  CampaignVaultSubmissionOutcome,
  CampaignVaultInvocationOutcome,
  ContractOperationName,
  PrepareCampaignVaultInvocationInput,
  PreparedCampaignVaultInvocation,
  VerifiedCampaignVaultInvocation,
  VerifyCampaignVaultInvocationInput
} from "../../application/ports/campaign-vault-invocation-port.js";
import { createSorobanRpcServer } from "./soroban-rpc.js";

/** The slice of `rpc.Server` this adapter depends on. */
export interface SorobanInvocationSource {
  getAccount(accountId: string): Promise<Account>;
  prepareTransaction(tx: Transaction): Promise<Transaction>;
  sendTransaction(tx: Transaction): Promise<rpc.Api.SendTransactionResponse>;
  getTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse>;
}

/**
 * A signed invocation must expire, same reasoning as
 * `stellar-funding-intent-xdr.ts`'s `DEFAULT_MAX_TIME_SECONDS`: long enough
 * for a Freighter prompt, short enough that a leaked signed envelope is
 * useless quickly.
 */
const INVOCATION_TIMEOUT_SECONDS = 15 * 60;

/**
 * Builds, verifies, submits and polls the signed Soroban invocations that
 * call the campaign vault contract (`contribute`, `withdraw`, `refund`).
 *
 * Nothing here ever signs. `prepare` returns an unsigned, already-simulated
 * envelope for Freighter to sign in the web; `verify` only ever calls
 * `Keypair.verify` — cryptographic verification, never signature production —
 * mirroring `StellarFundingIntentXdr`'s own never-signs contract.
 */
export class StellarCampaignVaultInvocation implements CampaignVaultInvocationPort {
  private readonly networkPassphrase: string;
  private readonly source: SorobanInvocationSource;

  constructor(config: StellarConfig, source?: SorobanInvocationSource) {
    this.networkPassphrase = config.networkPassphrase;
    this.source = source ?? defaultInvocationSource(config);
  }

  async prepare(
    input: PrepareCampaignVaultInvocationInput
  ): Promise<CampaignVaultInvocationResult<PreparedCampaignVaultInvocation>> {
    const args = expectedInvocationArgs(input);

    if (args === null) {
      return { ok: false, error: { code: "invalid_input", reason: "arguments" } };
    }

    let account: Account;

    try {
      account = await this.source.getAccount(input.sourceAccountId);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    const maxTime = Math.floor(Date.now() / 1000) + INVOCATION_TIMEOUT_SECONDS;
    let unprepared: Transaction;

    try {
      const contract = new Contract(input.contractAddress);
      unprepared = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(contract.call(input.operation, ...args))
        .setTimeout(INVOCATION_TIMEOUT_SECONDS)
        .build();
    } catch {
      return { ok: false, error: { code: "invalid_input" } };
    }

    let prepared: Transaction;

    try {
      prepared = await this.source.prepareTransaction(unprepared);
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }

    return {
      ok: true,
      value: {
        xdr: prepared.toXdr(),
        networkPassphrase: this.networkPassphrase,
        expiresAt: new Date(maxTime * 1000).toISOString()
      }
    };
  }

  verify(input: VerifyCampaignVaultInvocationInput): CampaignVaultInvocationVerification {
    let transaction: Transaction | FeeBumpTransaction;

    try {
      transaction = TransactionBuilder.fromXDR(input.signedXdr, input.networkPassphrase);
    } catch {
      return refuse("malformed", "envelope");
    }

    // Outer-fee indirection: a fee-bump could carry a different inner
    // transaction past every check below, so it is refused outright —
    // the same reasoning `StellarFundingIntentXdr.verify` applies.
    if (transaction instanceof FeeBumpTransaction) {
      return refuse("malformed", "fee_bump");
    }

    try {
      return this.verifyDecoded(transaction, input);
    } catch {
      return refuse("malformed", "envelope");
    }
  }

  async submit(signedXdr: string): Promise<CampaignVaultInvocationResult<CampaignVaultSubmissionOutcome>> {
    let transaction: Transaction;

    try {
      transaction = this.decode(signedXdr);
    } catch {
      return { ok: false, error: { code: "invalid_input" } };
    }

    try {
      return classifySendStatus(await this.source.sendTransaction(transaction));
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findResult(hash: string): Promise<CampaignVaultInvocationResult<CampaignVaultInvocationOutcome>> {
    try {
      return { ok: true, value: classifyTransactionStatus(await this.source.getTransaction(hash)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  private verifyDecoded(
    transaction: Transaction,
    input: VerifyCampaignVaultInvocationInput
  ): CampaignVaultInvocationVerification {
    const operations = transaction.operations;

    if (operations.length !== 1) {
      return refuse("malformed", "operation_count");
    }

    const operation = operations[0];

    if (operation === undefined || operation.type !== "invokeHostFunction") {
      return refuse("malformed", "operation_type");
    }

    const hostFunction = operation.func;

    if (hostFunction.type !== "hostFunctionTypeInvokeContract") {
      return refuse("malformed", "host_function_type");
    }

    const invocation = hostFunction.invokeContract;
    const contractAddress = Address.fromScAddress(invocation.contractAddress).toString();

    if (contractAddress !== input.contractAddress) {
      return refuse("wrong_contract");
    }

    if (invocation.functionName.toString() !== input.operation) {
      return refuse("wrong_function");
    }

    const expectedArgs = expectedInvocationArgs(input);

    if (expectedArgs === null) {
      return refuse("malformed", "expected_arguments");
    }

    if (!argsEqual(invocation.args, expectedArgs)) {
      return refuse("wrong_arguments");
    }

    // `refund` is permissionless (contract-level, `lib.rs::refund`): the
    // caller may leave `sourceAccountId` unset, and then any self-signed
    // source is accepted — only the arguments (destination) are checked
    // above, never who triggered it.
    if (input.sourceAccountId !== undefined && transaction.source !== input.sourceAccountId) {
      return refuse("wrong_source");
    }

    const bounds = transaction.timeBounds;
    const now = BigInt(Math.floor(Date.now() / 1000));

    if (bounds === undefined || bounds.maxTime === "0" || BigInt(bounds.maxTime) <= now) {
      return refuse("expired", "timebounds");
    }

    const signer = toKeypairOrNull(transaction.source);

    if (signer === null) {
      return refuse("malformed", "source");
    }

    const hash = transaction.hash();
    const signed = transaction.signatures.some((signature) => signer.verify(hash, signature.signature));

    if (!signed) {
      return refuse("bad_signature", transaction.signatures.length === 0 ? "missing" : "signature");
    }

    const verified: VerifiedCampaignVaultInvocation = {
      transactionHash: Buffer.from(hash).toString("hex"),
      sourceAccountId: transaction.source,
      operation: input.operation,
      investorAccountId: input.investorAccountId,
      ...(input.operation === "contribute" ? { amountStroops: input.amountStroops } : {})
    };

    return { ok: true, value: verified };
  }

  /** Mirrors `StellarTransaction.decode`: refuses a fee-bump wrapper for the same reason. */
  private decode(signedXdr: string): Transaction {
    const decoded = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);

    if (decoded instanceof FeeBumpTransaction) {
      throw new Error("A fee-bump envelope is not submittable");
    }

    return decoded;
  }
}

function refuse(code: CampaignVaultInvocationRefusalCode, reason?: string): CampaignVaultInvocationVerification {
  return { ok: false, refusal: { code, ...(reason === undefined ? {} : { reason }) } };
}

/**
 * The arguments the contract call must carry for a given operation, encoded
 * exactly as `prepare` would build them — shared by `prepare` (to build the
 * call) and `verify` (to compare against what the signed envelope actually
 * carries), so the two can never drift apart.
 *
 * `null` means the input itself is inconsistent for the operation (missing
 * `amountStroops` on `contribute`, or a stray one on `withdraw`/`refund`, or
 * an unparseable investor account id) — not a fact about a signed envelope.
 */
function expectedInvocationArgs(input: {
  readonly operation: ContractOperationName;
  readonly investorAccountId: string;
  readonly amountStroops?: bigint;
}): xdr.ScVal[] | null {
  let investor: xdr.ScVal;

  try {
    investor = new Address(input.investorAccountId).toScVal();
  } catch {
    return null;
  }

  if (input.operation === "contribute") {
    if (input.amountStroops === undefined || input.amountStroops <= 0n) {
      return null;
    }

    return [investor, nativeToScVal(input.amountStroops, { type: "i128" })];
  }

  if (input.amountStroops !== undefined) {
    return null;
  }

  return [investor];
}

/** Compares by encoded XDR bytes rather than decoding each argument — the arguments' native types differ per position (address vs. i128), so comparing what `nativeToScVal` would itself produce is simpler than decoding both sides. */
function argsEqual(actual: readonly xdr.ScVal[], expected: readonly xdr.ScVal[]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  return actual.every((value, index) => value.toXDR("base64") === expected[index]?.toXDR("base64"));
}

function toKeypairOrNull(accountId: string): Keypair | null {
  try {
    return Keypair.fromPublicKey(accountId);
  } catch {
    return null;
  }
}

/**
 * `PENDING` and `DUPLICATE` both mean core has the envelope in flight — not a
 * verdict, only that it was accepted for consideration — same split
 * `stellar-transaction.ts`'s own `classifyStatus` makes for Horizon's
 * `tx_status`. `TRY_AGAIN_LATER` is transient; an unrecognised status is
 * treated the same way rather than guessed at.
 */
function classifySendStatus(
  response: rpc.Api.SendTransactionResponse
): CampaignVaultInvocationResult<CampaignVaultSubmissionOutcome> {
  switch (response.status) {
    case "PENDING":
    case "DUPLICATE":
      return { ok: true, value: { hash: response.hash, status: "accepted" } };
    case "ERROR":
      return { ok: true, value: { hash: response.hash, status: "rejected" } };
    case "TRY_AGAIN_LATER":
    default:
      return { ok: false, error: { code: "unavailable" } };
  }
}

/** `NOT_FOUND` is the expected state of every submission for its first few seconds, not an error — same reasoning as `StellarTransactionPort.findTransaction`'s own doc. */
function classifyTransactionStatus(response: rpc.Api.GetTransactionResponse): CampaignVaultInvocationOutcome {
  switch (response.status) {
    case rpc.Api.GetTransactionStatus.SUCCESS:
      return { status: "success" };
    case rpc.Api.GetTransactionStatus.FAILED:
      return { status: "failed" };
    case rpc.Api.GetTransactionStatus.NOT_FOUND:
    default:
      return { status: "pending" };
  }
}

function defaultInvocationSource(config: StellarConfig): SorobanInvocationSource {
  const server = createSorobanRpcServer(config);

  return {
    getAccount: (accountId) => server.getAccount(accountId),
    prepareTransaction: (transaction) => server.prepareTransaction(transaction),
    sendTransaction: (transaction) => server.sendTransaction(transaction),
    getTransaction: (hash) => server.getTransaction(hash)
  };
}
