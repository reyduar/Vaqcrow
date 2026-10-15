import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import { DEFAULT_TESTNET_HORIZON_URL, HorizonWalletBalanceAdapter } from "./horizon-wallet-balance-adapter";

const PUBLIC_KEY = "GDPBT572AGQCVSRF2K6DSAZPEFOTMD3C3JZUKWMW3R2RSXRPSRNWFCDR";

/** A Horizon `GET /accounts/{id}` body trimmed to the fields the adapter reads. */
function account(balances: readonly unknown[]) {
  return { id: PUBLIC_KEY, balances };
}

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: string[] = [];
  const client = {
    get: async (url: string) => {
      calls.push(url);
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HorizonWalletBalanceAdapter", () => {
  it("reads the account's native XLM balance from Horizon", async () => {
    const { client, calls } = fakeClient({
      status: 200,
      data: account([
        { asset_type: "credit_alphanum4", asset_code: "USDC", balance: "12.0000000" },
        { asset_type: "native", balance: "10000.0000000" }
      ])
    });
    const port: WalletBalancePort = new HorizonWalletBalanceAdapter(client);

    expect(await port.getBalance(PUBLIC_KEY)).toEqual({ ok: true, balanceXlm: "10000.0000000" });
    expect(calls).toEqual([`/accounts/${PUBLIC_KEY}`]);
  });

  it("treats an account Horizon does not know (404, never funded) as an empty balance", async () => {
    const { client } = fakeClient({ status: 404, data: { status: 404, title: "Resource Missing" } });

    expect(await new HorizonWalletBalanceAdapter(client).getBalance(PUBLIC_KEY)).toEqual({
      ok: true,
      balanceXlm: "0.0000000"
    });
  });

  it("reports a Horizon error status as unavailable, never as a zero balance", async () => {
    const { client } = fakeClient({ status: 503, data: {} });

    expect(await new HorizonWalletBalanceAdapter(client).getBalance(PUBLIC_KEY)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("reports a malformed success body as unavailable", async () => {
    const { client } = fakeClient({ status: 200, data: account([{ asset_type: "native" }]) });

    expect(await new HorizonWalletBalanceAdapter(client).getBalance(PUBLIC_KEY)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("reports a transport failure as network", async () => {
    const { client } = fakeClient(new Error("socket hang up"));

    expect(await new HorizonWalletBalanceAdapter(client).getBalance(PUBLIC_KEY)).toEqual({
      ok: false,
      code: "network"
    });
  });

  it("percent-encodes the account id so it cannot change the request path", async () => {
    const { client, calls } = fakeClient({ status: 404, data: {} });

    await new HorizonWalletBalanceAdapter(client).getBalance("G../../fee_stats?x=1");

    expect(calls).toEqual(["/accounts/G..%2F..%2Ffee_stats%3Fx%3D1"]);
  });

  it("defaults to the canonical Testnet Horizon endpoint", () => {
    expect(DEFAULT_TESTNET_HORIZON_URL).toBe("https://horizon-testnet.stellar.org");
  });
});
