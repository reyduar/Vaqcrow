import {
  getNetwork as freighterGetNetwork,
  isConnected as freighterIsConnected,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction
} from "@stellar/freighter-api";
import { WalletError } from "@/application/ports/wallet-port";
import type { WalletAccount, WalletPort } from "@/application/ports/wallet-port";

/**
 * The failure shape `@stellar/freighter-api` resolves with. The package does not
 * throw for a refused or impossible request: it resolves a result carrying this
 * error, so every call site has to inspect the returned value.
 *
 * Both a declined signature and an internal failure carry `code: -1`, so the
 * code cannot discriminate between them and the message is the only signal.
 */
export interface FreighterApiError {
  readonly code: number;
  readonly message: string;
}

/**
 * The slice of `@stellar/freighter-api` this adapter depends on.
 *
 * Declaring it here — instead of importing the package's own signatures at each
 * call site — is what makes the deterministic double from the Feature's testing
 * strategy possible, and keeps the adapter testable without a browser.
 */
export interface FreighterApi {
  isConnected(): Promise<{ isConnected: boolean; error?: FreighterApiError }>;
  requestAccess(): Promise<{ address: string; error?: FreighterApiError }>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string; error?: FreighterApiError }>;
  signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string }
  ): Promise<{ signedTxXdr: string; signerAddress: string; error?: FreighterApiError }>;
}

/** Messages documented by Freighter, verified against `@stellar/freighter-api@6.0.1`. */
const REJECTED_MESSAGE = "The user rejected this request.";
const NODE_ENVIRONMENT_MESSAGE = "Node environment is not supported";
const INTERNAL_ERROR_PREFIX = "The wallet encountered an internal error";

/**
 * Maps a wallet failure onto the port's kind. Only the outcomes a person can act
 * on are named; anything else stays `unknown` so the caller does not offer a
 * retry that has no reason to succeed.
 */
function classify(error: FreighterApiError): WalletError {
  if (error.message === REJECTED_MESSAGE) {
    return new WalletError("rejected", error.message);
  }

  if (error.message === NODE_ENVIRONMENT_MESSAGE || error.message.startsWith(INTERNAL_ERROR_PREFIX)) {
    return new WalletError("unavailable", error.message);
  }

  return new WalletError("unknown", error.message);
}

const realFreighterApi: FreighterApi = {
  isConnected: freighterIsConnected,
  requestAccess: freighterRequestAccess,
  getNetwork: freighterGetNetwork,
  signTransaction: freighterSignTransaction
};

/**
 * Adapter for the Freighter browser extension wallet.
 *
 * Freighter is a wallet and signing surface, not a custodian: this adapter only
 * ever handles the public address and transaction XDR. It has no method that
 * accepts or returns a seed, mnemonic or private key, and it never asks the
 * extension for one — the person reviews and signs inside Freighter.
 */
export class FreighterWallet implements WalletPort {
  constructor(private readonly api: FreighterApi = realFreighterApi) {}

  async isAvailable(): Promise<boolean> {
    try {
      const { isConnected, error } = await this.api.isConnected();
      return error === undefined && isConnected;
    } catch {
      // An availability probe reports availability; it never raises.
      return false;
    }
  }

  /**
   * Requests access to a public address.
   *
   * Availability is probed first, and deliberately so: `requestAccess` resolves
   * only when the extension answers and has no timeout of its own, so calling it
   * with no extension installed leaves the caller waiting forever. The probe
   * (`isConnected`) does time out, which turns a missing wallet into a normal,
   * recoverable `unavailable` failure instead of a hang.
   */
  async connect(): Promise<WalletAccount> {
    if (!(await this.isAvailable())) {
      throw new WalletError("unavailable", "Freighter is not available in this browser");
    }

    const { address, error } = await this.api.requestAccess();

    if (error) {
      throw classify(error);
    }

    if (!address) {
      throw new WalletError("unknown", "Freighter granted access without returning a public address");
    }

    return { publicKey: address };
  }

  /**
   * Asks Freighter to sign an unsigned XDR for an explicitly named network.
   *
   * The passphrase has no default: an omitted network would let the extension
   * decide, so the integration refuses instead. The wallet's own network is
   * checked first, which means a wallet pointed at another network is caught
   * before the person is asked to approve anything.
   */
  async signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    if (!networkPassphrase) {
      throw new WalletError("unknown", "A network passphrase is required to request a signature");
    }

    const walletNetwork = await this.api.getNetwork();
    if (walletNetwork.error) {
      throw classify(walletNetwork.error);
    }

    if (walletNetwork.networkPassphrase !== networkPassphrase) {
      throw new WalletError(
        "network_mismatch",
        `Freighter is on "${walletNetwork.network}", not the network the transaction declares`
      );
    }

    const { signedTxXdr, error } = await this.api.signTransaction(xdr, { networkPassphrase });
    if (error) {
      throw classify(error);
    }

    if (!signedTxXdr) {
      throw new WalletError("unknown", "Freighter reported success without returning a signed transaction");
    }

    return signedTxXdr;
  }
}
