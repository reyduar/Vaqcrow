import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  type xdr
} from "@stellar/stellar-sdk";
import { LIVE_NETWORK_PASSPHRASE, LIVE_RPC_URL } from "./live-targets";

/**
 * Read-only Soroban RPC probes for the admin-review live rehearsal. They read
 * the deployed vault straight from the local network (simulation only:
 * nothing here is signed or submitted), independently of the API's own
 * chain-observed snapshot, so the rehearsal can check the vault's goal,
 * destination and state — and that the contract itself, not only the API
 * preflight, refuses a contribution above `goal / 10`.
 */
const server = new rpc.Server(LIVE_RPC_URL, { allowHttp: true });

async function simulate(
  sourcePublicKey: string,
  contractId: string,
  method: string,
  args: readonly xdr.ScVal[] = []
): Promise<rpc.Api.SimulateTransactionResponse> {
  const account = await server.getAccount(sourcePublicKey);
  const transaction = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: LIVE_NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  return server.simulateTransaction(transaction);
}

/** Calls a no-argument view function and returns its native value. */
export async function readVault(sourcePublicKey: string, contractId: string, method: string): Promise<unknown> {
  const simulation = await simulate(sourcePublicKey, contractId, method);
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
    throw new Error(`Simulating ${method}() on ${contractId} failed: ${JSON.stringify(simulation)}`);
  }
  return scValToNative(simulation.result.retval);
}

/**
 * Simulates `contribute(investor, amount)` with the investor as source. A
 * simulation runs the contract's own checks (auth is recorded, not
 * enforced), so a cap refusal surfaces as the contract error code.
 */
export async function simulateContribute(
  investorPublicKey: string,
  contractId: string,
  amountStroops: bigint
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  const simulation = await simulate(investorPublicKey, contractId, "contribute", [
    new Address(investorPublicKey).toScVal(),
    nativeToScVal(amountStroops, { type: "i128" })
  ]);
  if (rpc.Api.isSimulationError(simulation)) return { ok: false, error: simulation.error };
  return { ok: true };
}
