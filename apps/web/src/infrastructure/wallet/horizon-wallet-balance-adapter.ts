import axios, { type AxiosInstance } from "axios";
import type { WalletBalancePort, WalletBalanceResult } from "@/application/ports/wallet-balance-port";

/**
 * Canonical Testnet Horizon. A default, not a required variable: the same
 * settled decision that makes `STELLAR_HORIZON_URL` optional in the API.
 */
export const DEFAULT_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Horizon's balance for an account that does not exist on the ledger yet. */
const UNFUNDED_BALANCE_XLM = "0.0000000";

/**
 * Live balance for the wallet card (Feature #557), read from Horizon
 * `GET /accounts/{id}` over plain HTTP: the boundary rule
 * `web-never-imports-server-stellar-sdk` keeps the Stellar SDK out of the
 * browser bundle. It replaces the deterministic simulated adapter (#406/#407),
 * which always reported `0.0000000` even after Friendbot funded the account.
 *
 * A 404 means the account was never funded, which is a real zero balance and
 * keeps the funding guide's warning. Any other non-200 status or a malformed
 * body is the sanitized `unavailable`, and a transport failure is `network`:
 * an error never turns into a fake zero. The account id is percent-encoded so
 * it cannot change the request path.
 */
export class HorizonWalletBalanceAdapter implements WalletBalancePort {
  constructor(private readonly client: AxiosInstance) {}

  /** Builds the adapter around a dedicated axios instance pointed at `horizonUrl`. */
  static create(horizonUrl: string = DEFAULT_TESTNET_HORIZON_URL): HorizonWalletBalanceAdapter {
    return new HorizonWalletBalanceAdapter(axios.create({ baseURL: horizonUrl, validateStatus: () => true }));
  }

  async getBalance(publicKey: string): Promise<WalletBalanceResult> {
    try {
      const response = await this.client.get(`/accounts/${encodeURIComponent(publicKey)}`, {
        validateStatus: () => true
      });
      if (response.status === 404) return { ok: true, balanceXlm: UNFUNDED_BALANCE_XLM };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      const balanceXlm = nativeBalance(response.data);
      return balanceXlm === null ? { ok: false, code: "unavailable" } : { ok: true, balanceXlm };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}

/** The `native` entry of a Horizon account's `balances`, or `null` when the body does not carry one. */
function nativeBalance(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const balances: unknown = (body as { balances?: unknown }).balances;
  if (!Array.isArray(balances)) return null;
  for (const entry of balances) {
    if (typeof entry !== "object" || entry === null) continue;
    const { asset_type: assetType, balance } = entry as { asset_type?: unknown; balance?: unknown };
    if (assetType !== "native") continue;
    return typeof balance === "string" && Number.isFinite(Number(balance)) && balance.trim() !== "" ? balance : null;
  }
  return null;
}
