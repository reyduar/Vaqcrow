import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";

/**
 * Null-object `WalletConnectionPort` for when no backend is configured: every
 * call answers a sanitized `unavailable` so the UI reports the failure instead
 * of throwing, and never stores a key. Kept in its own module so importing it
 * never pulls in the browser auth/Supabase wiring.
 */
export const UNAVAILABLE_WALLET_CONNECTION_PORT: WalletConnectionPort = Object.freeze({
  requestChallenge: async () => ({ ok: false as const, code: "unavailable" as const }),
  submitConnection: async () => ({ ok: false as const, code: "unavailable" as const }),
  getConnection: async () => ({ ok: false as const, code: "unavailable" as const })
});
