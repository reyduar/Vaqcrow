import type { WalletFailureEvent } from "@vaqcrow/contracts";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type { WalletFailureReporterPort } from "@/application/ports/wallet-failure-reporter-port";

/** The WU4a client→API endpoint — the only consumer of the reported vocabulary. */
const PATH = "/telemetry/wallet-failures";

/**
 * Reports a wallet failure over HTTP (#31, WU4b).
 *
 * Best-effort by construction: `report` kicks the request off and returns, and
 * every failure — a rejected fetch, an HTTP error status, a timeout — is
 * swallowed inside the promise. The caller never awaits it and never sees it,
 * so telemetry cannot change the wallet's error surface.
 *
 * The body is rebuilt from `operation` and `outcome` alone, so only the closed
 * vocabulary ever crosses the wire even if the event object ever carried more.
 */
export class HttpWalletFailureReporter implements WalletFailureReporterPort {
  constructor(private readonly http: HttpClientPort) {}

  report(event: WalletFailureEvent): void {
    void this.send(event);
  }

  private async send(event: WalletFailureEvent): Promise<void> {
    try {
      await this.http.send({
        method: "POST",
        path: PATH,
        body: { operation: event.operation, outcome: event.outcome }
      });
    } catch {
      // Best-effort telemetry: a failed report is invisible to the caller.
    }
  }
}
