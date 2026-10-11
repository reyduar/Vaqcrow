import { describe, expect, it, vi } from "vitest";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import { HttpWalletFailureReporter } from "./http-wallet-failure-reporter";

/**
 * `HTTPClientPort` double, mirroring the SME gateway's test shape. The reporter
 * only ever calls `send`, so the fake is a `vi.fn` returning a resolved
 * `202` — the success the WU4a route answers with.
 */
function client() {
  const send = vi.fn().mockResolvedValue({ status: 202, body: { accepted: true } });
  return { port: { send } as unknown as HttpClientPort, send };
}

describe("HttpWalletFailureReporter", () => {
  it("POSTs the exact wire body to /telemetry/wallet-failures", async () => {
    const { port, send } = client();

    new HttpWalletFailureReporter(port).report({
      operation: "sign_transaction",
      outcome: "network_mismatch"
    });

    // `report` is fire-and-forget, so the request settles on a later microtask.
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: "/telemetry/wallet-failures",
      body: { operation: "sign_transaction", outcome: "network_mismatch" }
    });
  });

  it("returns synchronously, without waiting for the request", () => {
    const { port } = client();

    const result = new HttpWalletFailureReporter(port).report({
      operation: "connect",
      outcome: "rejected"
    });

    expect(result).toBeUndefined();
  });

  it("swallows an HTTP failure without throwing", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network down"));
    const reporter = new HttpWalletFailureReporter({ send } as unknown as HttpClientPort);

    expect(() => reporter.report({ operation: "connect", outcome: "rejected" })).not.toThrow();
    // Let the rejected `send` settle: it must not surface as an unhandled
    // rejection either.
    await Promise.resolve();
  });

  it("sends only operation and outcome, never a drifted third key", async () => {
    const { port, send } = client();

    new HttpWalletFailureReporter(port).report({ operation: "sign_message", outcome: "rejected" });

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const request = send.mock.calls[0]?.[0] as { body: Record<string, unknown> };
    expect(Object.keys(request.body).sort()).toEqual(["operation", "outcome"]);
  });
});
