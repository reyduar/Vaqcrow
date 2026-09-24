import { LIVE_FRIENDBOT_URL, LIVE_HORIZON_URL, STROOPS_PER_XLM } from "./live-targets";

/**
 * Thin Horizon/Friendbot client for the live journey's own assertions — this
 * is verification tooling, not application code, so it lives in `e2e-live/`
 * and reads Horizon directly rather than going through the API's own
 * chain-observed snapshot (the thing under test).
 */

interface HorizonBalance {
  readonly asset_type: string;
  readonly balance: string;
}

interface HorizonAccount {
  readonly balances: readonly HorizonBalance[];
}

/** `true` once the account exists on the ledger (Horizon 200), `false` on a 404. Any other failure throws. */
export async function accountExists(accountId: string): Promise<boolean> {
  const response = await fetch(`${LIVE_HORIZON_URL}/accounts/${accountId}`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Horizon returned ${String(response.status)} reading account ${accountId}`);
  return true;
}

/** The account's native XLM balance, as stroops — `undefined` when the account does not exist yet. */
export async function nativeBalanceStroops(accountId: string): Promise<bigint | undefined> {
  const response = await fetch(`${LIVE_HORIZON_URL}/accounts/${accountId}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Horizon returned ${String(response.status)} reading account ${accountId}`);

  const account = (await response.json()) as HorizonAccount;
  const native = account.balances.find((balance) => balance.asset_type === "native");
  if (!native) throw new Error(`Account ${accountId} has no native balance entry`);

  // Horizon reports a decimal string with up to 7 fraction digits; parse it
  // as whole/fraction so no floating point ever touches a stroop count.
  const [whole = "0", fraction = ""] = native.balance.split(".");
  const paddedFraction = fraction.padEnd(7, "0").slice(0, 7);
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(paddedFraction || "0");
}

/** Polls Horizon until an account exists, or throws once `timeoutMs` elapses. */
export async function waitForAccount(accountId: string, timeoutMs = 60_000, intervalMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await accountExists(accountId)) return;
    if (Date.now() >= deadline) {
      throw new Error(`Account ${accountId} still does not exist on Horizon after ${String(timeoutMs)}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Funds a fresh account with the local Quickstart's Friendbot. Never used
 * for the SME identity (the platform must create that account itself — the
 * whole point of scenario `a`).
 */
export async function fundWithFriendbot(accountId: string): Promise<void> {
  const response = await fetch(`${LIVE_FRIENDBOT_URL}?addr=${encodeURIComponent(accountId)}`);
  if (!response.ok) {
    throw new Error(`Friendbot refused to fund ${accountId}: ${String(response.status)} ${await response.text()}`);
  }
}
