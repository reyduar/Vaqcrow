import type { Page } from "@playwright/test";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { keypairFor } from "./identities";

/**
 * Live-network twin of `apps/web/e2e/support/freighter-emulator.ts`: same
 * `@stellar/freighter-api@6.0.1` `window.postMessage` protocol (see that
 * module's own doc comment for the verified message shapes), but
 * `SUBMIT_TRANSACTION` produces a **real** signature instead of an opaque
 * fake one — the stub API never checked a signature, but the live docker
 * profile's Soroban RPC does.
 *
 * D4 (`odd/tasks/campaign-vault-web-tests.md`): the web can never import
 * `@stellar/stellar-sdk` (`web-never-imports-server-stellar-sdk`), so the
 * page cannot sign anything itself even in a test. The signature is produced
 * here, in the Playwright/Node process, and handed back to the page through
 * a `page.exposeFunction` bridge (`vaqcrowLiveSign`) — the page passes an
 * unsigned XDR string and a public key across that bridge and receives a
 * signed XDR string back; the private key itself never crosses into the
 * page, never appears in the DOM, console, or network tab.
 */

export interface LiveFreighterScenario {
  readonly publicKey: string;
  readonly networkPassphrase: string;
  readonly network: string;
}

const STORAGE_KEY = "__vaqcrow_e2e_live_freighter_scenario__";
const REJECTED_API_ERROR = { code: -1, message: "The user rejected this request." };

/**
 * Registers the signing bridge and the one message listener this page will
 * ever have. Call once per test, before the first navigation — mirrors
 * `installFreighterEmulator`'s own contract.
 */
export async function installLiveFreighterEmulator(page: Page): Promise<void> {
  await page.exposeFunction(
    "vaqcrowLiveSign",
    async (xdr: string, networkPassphrase: string, publicKey: string): Promise<string> => {
      const keypair = keypairFor(publicKey);
      const transaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
      transaction.sign(keypair);
      return transaction.toXDR();
    }
  );

  await page.addInitScript(
    ({ storageKey, rejectedApiError }) => {
      window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data as { source?: unknown; messageId?: unknown; type?: unknown; transactionXdr?: unknown };
        if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        let scenario: { publicKey?: string; networkPassphrase?: string; network?: string } | null = null;
        try {
          const raw = window.sessionStorage.getItem(storageKey);
          scenario = raw ? JSON.parse(raw) : null;
        } catch {
          scenario = null;
        }

        // No scenario: stay silent, exactly like a browser with no Freighter
        // extension — the library's own bounded timeout reports "unavailable".
        if (!scenario) return;

        const respond = (payload: Record<string, unknown>) => {
          window.postMessage(
            { source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: data.messageId, ...payload },
            window.location.origin
          );
        };

        switch (data.type) {
          case "REQUEST_CONNECTION_STATUS":
            respond({ isConnected: true });
            return;
          case "REQUEST_ACCESS":
            respond({ publicKey: scenario.publicKey ?? "" });
            return;
          case "REQUEST_NETWORK_DETAILS":
            respond({
              networkDetails: {
                network: scenario.network ?? "LOCAL",
                networkName: scenario.network ?? "LOCAL",
                networkUrl: "http://127.0.0.1:8000/rpc",
                networkPassphrase: scenario.networkPassphrase ?? "",
                sorobanRpcUrl: "http://127.0.0.1:8000/rpc"
              }
            });
            return;
          case "SUBMIT_TRANSACTION": {
            const xdr = String(data.transactionXdr ?? "");
            const sign = (
              window as unknown as {
                vaqcrowLiveSign: (xdr: string, networkPassphrase: string, publicKey: string) => Promise<string>;
              }
            ).vaqcrowLiveSign;

            sign(xdr, scenario.networkPassphrase ?? "", scenario.publicKey ?? "")
              .then((signedTransaction: string) => {
                respond({ signedTransaction, signerAddress: scenario?.publicKey ?? "" });
              })
              .catch(() => {
                respond({ signedTransaction: "", signerAddress: "", apiError: rejectedApiError });
              });
            return;
          }
          default:
            return;
        }
      });
    },
    { storageKey: STORAGE_KEY, rejectedApiError: REJECTED_API_ERROR }
  );
}

/**
 * Sets (or clears, with `null`) the active identity for the page's current
 * document. Requires a loaded document on the target origin — call after
 * `page.goto`. Unlike the deterministic emulator, there is no `installed` or
 * `onAccess`/`onSign` rejection toggle: every live scenario is a real,
 * already-registered (`identities.ts`) signing identity.
 */
export async function setLiveFreighterScenario(page: Page, scenario: LiveFreighterScenario | null): Promise<void> {
  await page.evaluate(
    ({ storageKey, value }) => {
      if (value === null) window.sessionStorage.removeItem(storageKey);
      else window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    },
    { storageKey: STORAGE_KEY, value: scenario }
  );
}
