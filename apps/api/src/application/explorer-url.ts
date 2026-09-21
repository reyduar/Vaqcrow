/**
 * Builds the Testnet explorer link for a transaction.
 *
 * The link is derived rather than stored: the hash is already persisted, so a
 * stored URL would be a second source of truth for a fact the hash determines, and
 * it could drift from the network the hash belongs to.
 *
 * It is built in the API rather than in the browser on purpose (`D1`): the web
 * holds no opinion about the network, so it is told where a hash opens instead of
 * deciding — the same reason it never holds the passphrase.
 *
 * The base is expected to arrive already normalised by configuration, which strips
 * the trailing slash so a link cannot end up with a doubled separator. The strip
 * here is idempotent with that and exists so a caller that bypasses configuration
 * cannot produce one either.
 */
export function transactionExplorerUrl(explorerBaseUrl: string, transactionHash: string): string {
  return `${explorerBaseUrl.replace(/\/+$/, "")}/tx/${transactionHash}`;
}
