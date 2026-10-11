import { z } from "zod";

/**
 * A wallet failure the browser observed, reported back to the API (#31).
 *
 * This is the client→API half of the wallet-failure beacon: the web classifies
 * a Freighter failure (it is the only side that can see the wallet at all) and
 * reports the classification here, where it is logged with the request's own
 * correlation id. The API never sees the wallet, the signature or the key — only
 * this closed, text-free vocabulary — so nothing sensitive can cross the wire.
 *
 * Two closed enums, both deliberately named after the *operation* the person
 * attempted rather than the port method that threw. The web port exposes
 * `connect` / `signTransaction` / `signMessage`; the wire names are snake_case,
 * so a rename inside the adapter can never silently change a contract value.
 * The outcomes are exactly the four kinds `WalletPort` classifies (`rejected`,
 * `unavailable`, `network_mismatch`, `unknown`) — a value the web cannot
 * produce is refused rather than passed through.
 */
export const walletFailureOperationSchema = z.enum([
  /** The person tried to connect their wallet. */
  "connect",
  /** The person tried to sign a Stellar transaction envelope. */
  "sign_transaction",
  /** The person tried to sign a UTF-8 message (SEP-53). */
  "sign_message"
]);

export const walletFailureOutcomeSchema = z.enum([
  /** The person declined the request inside the wallet. */
  "rejected",
  /** There was no wallet to talk to. */
  "unavailable",
  /** The wallet is connected to a different network. */
  "network_mismatch",
  /** The failure has no more specific name. */
  "unknown"
]);

/**
 * A reported wallet failure. A strict object on purpose: the vocabulary is the
 * whole point, so a body carrying a drifted key (a public key, an XDR, an error
 * message) is refused rather than quietly stripped.
 *
 * There is no `correlationId` field: the web holds none. The API logs its own
 * request id as the correlation, which is the only identifier that means
 * anything on this side of the wire.
 */
export const walletFailureEventSchema = z.strictObject({
  operation: walletFailureOperationSchema,
  outcome: walletFailureOutcomeSchema
});

export type WalletFailureOperation = z.infer<typeof walletFailureOperationSchema>;
export type WalletFailureOutcome = z.infer<typeof walletFailureOutcomeSchema>;
export type WalletFailureEvent = z.infer<typeof walletFailureEventSchema>;

export function parseWalletFailureEvent(input: unknown): WalletFailureEvent {
  return walletFailureEventSchema.parse(input);
}
