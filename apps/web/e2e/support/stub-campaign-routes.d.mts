/**
 * Types for `stub-campaign-routes.mjs`. The E2E specs import the one derivation
 * the double owns — its campaign explorer link — so the expected `href` is the
 * stub's own value rather than a second literal invented by the spec. Keeping
 * the declaration here is what lets a strict `.ts` spec import the `.mjs`
 * sibling without an `allowJs` change to the web tsconfig.
 */
export declare const CAMPAIGN_EXPLORER_BASE_URL: string;
export declare function campaignExplorerUrl(contractAddress: string): string;
