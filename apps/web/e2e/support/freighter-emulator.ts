import type { Page } from "@playwright/test";

/**
 * Deterministic Freighter emulation for the campaign vault journey (Task
 * #248). `apps/web/src/infrastructure/wallet/freighter-wallet.ts` talks to
 * the real `@stellar/freighter-api` extension, which itself talks to the
 * page through `window.postMessage`. There is no test hook in production
 * code (`D2`): this module fakes the extension side of that protocol
 * instead, verified against `@stellar/freighter-api@6.0.1`'s own built
 * bundle (`node_modules/.pnpm/@stellar+freighter-api@6.0.1/.../build/index.min.js`):
 *
 * - Request: `window.postMessage({ source: "FREIGHTER_EXTERNAL_MSG_REQUEST", messageId, type, ...fields }, origin)`.
 * - Response: accepted only when `event.source === window` and
 *   `data.source === "FREIGHTER_EXTERNAL_MSG_RESPONSE"` and
 *   `data.messagedId === messageId` (library typo, not ours).
 * - `isConnected()`: short-circuits on `window.freighter` being a boolean;
 *   otherwise sends `REQUEST_CONNECTION_STATUS`, timing out to
 *   `{ isConnected: false }` after 2s (built into the library) when nothing answers.
 * - `requestAccess()`: sends `REQUEST_ACCESS`, expects `{ publicKey, apiError? }`.
 * - `getNetwork()`: sends `REQUEST_NETWORK_DETAILS` (not `REQUEST_NETWORK` —
 *   that enum value exists but is unused by the shipped `getNetwork`),
 *   expects `{ networkDetails: { network, networkName, networkUrl, networkPassphrase, sorobanRpcUrl }, apiError? }`.
 * - `signTransaction()`: sends `SUBMIT_TRANSACTION`, expects
 *   `{ signedTransaction, signerAddress, apiError? }`.
 *
 * The emulator itself never calls `Date.now`/`Math.random`; only the
 * (unmodified, vendored) library's own `messageId` generation does.
 */

/** What one test declares Freighter should do. `installed: false` leaves every request unanswered, so the library's own 2s timeout reports "not installed" — the real absence behavior, not a faked one. */
export interface FreighterScenario {
  readonly installed: boolean;
  readonly publicKey?: string;
  readonly networkPassphrase?: string;
  readonly network?: string;
  /** Default `"grant"`. */
  readonly onAccess?: "grant" | "reject";
  /** Default `"sign"`. */
  readonly onSign?: "sign" | "reject";
}

const STORAGE_KEY = "__vaqcrow_e2e_freighter_scenario__";

const REJECTED_API_ERROR = { code: -1, message: "The user rejected this request." };

/**
 * Registers the one message listener this test's page will ever have. Call
 * once per test, before the first navigation. The listener reads the active
 * scenario from `sessionStorage` on every incoming request (not a value
 * baked in at registration time), so `setFreighterScenario` can change or
 * clear the identity later in the same test — including after a
 * `page.goto` to a different path on the same origin, since `sessionStorage`
 * survives same-tab navigation — without ever registering a second listener.
 */
export async function installFreighterEmulator(page: Page): Promise<void> {
  await page.addInitScript(
    ({ storageKey, rejectedApiError }) => {
      window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data as { source?: unknown; messageId?: unknown; type?: unknown; transactionXdr?: unknown };
        if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        let scenario: {
          installed: boolean;
          publicKey?: string;
          networkPassphrase?: string;
          network?: string;
          onAccess?: "grant" | "reject";
          onSign?: "sign" | "reject";
        } | null = null;
        try {
          const raw = window.sessionStorage.getItem(storageKey);
          scenario = raw ? JSON.parse(raw) : null;
        } catch {
          scenario = null;
        }

        // No scenario, or explicitly "not installed": stay silent, exactly
        // like a browser with no Freighter extension. The library's own
        // bounded timeout (2s, for the request types that have one) is what
        // turns this into a reported "unavailable" failure.
        if (!scenario || !scenario.installed) return;

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
            if (scenario.onAccess === "reject") {
              respond({ publicKey: "", apiError: rejectedApiError });
            } else {
              respond({ publicKey: scenario.publicKey ?? "" });
            }
            return;
          case "REQUEST_NETWORK_DETAILS":
            respond({
              networkDetails: {
                network: scenario.network ?? "LOCAL",
                networkName: scenario.network ?? "LOCAL",
                networkUrl: "http://127.0.0.1:8000/soroban/rpc",
                networkPassphrase: scenario.networkPassphrase ?? "",
                sorobanRpcUrl: "http://127.0.0.1:8000/soroban/rpc"
              }
            });
            return;
          case "SUBMIT_TRANSACTION":
            if (scenario.onSign === "reject") {
              respond({ signedTransaction: "", signerAddress: "", apiError: rejectedApiError });
            } else {
              // Deterministic fake signed XDR: the stub API never verifies a
              // signature, so no real Stellar SDK or key material is needed.
              respond({
                signedTransaction: `EMULATED_SIGNED(${String(data.transactionXdr ?? "")})`,
                signerAddress: scenario.publicKey ?? ""
              });
            }
            return;
          default:
            return;
        }
      });
    },
    { storageKey: STORAGE_KEY, rejectedApiError: REJECTED_API_ERROR }
  );
}

/**
 * Sets (or clears, with `null`) the active scenario for the page's current
 * document. Requires a loaded document on the target origin — call it after
 * `page.goto`, not before. Takes effect immediately, with no reload: the
 * listener installed by `installFreighterEmulator` reads `sessionStorage`
 * fresh on every request.
 */
export async function setFreighterScenario(page: Page, scenario: FreighterScenario | null): Promise<void> {
  await page.evaluate(
    ({ storageKey, value }) => {
      if (value === null) window.sessionStorage.removeItem(storageKey);
      else window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    },
    { storageKey: STORAGE_KEY, value: scenario }
  );
}
