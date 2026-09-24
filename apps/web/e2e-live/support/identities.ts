import { Keypair } from "@stellar/stellar-sdk";
import { fundWithFriendbot } from "./horizon";

/**
 * Signing identities for the live journey (D4:
 * `odd/tasks/campaign-vault-web-tests.md`). Every keypair is generated
 * in-process with `Keypair.random()` and lives only in this Node process's
 * memory — never printed, never written to disk, never sent to the page.
 * `freighter-live-emulator.ts` signs on this process's behalf through a
 * `page.exposeFunction` bridge; the browser only ever sees a public key and a
 * signed XDR string.
 *
 * `apps/web/src` never imports `@stellar/stellar-sdk`
 * (`web-never-imports-server-stellar-sdk` in `.dependency-cruiser.cjs`) — that
 * rule is scoped to `apps/web/src/`, and dependency-cruiser itself is only run
 * over each workspace's own `src/` directory (`pnpm run boundaries`), so this
 * module, entirely under `apps/web/e2e-live/`, is outside both.
 */
const registry = new Map<string, Keypair>();

function register(keypair: Keypair): Keypair {
  registry.set(keypair.publicKey(), keypair);
  return keypair;
}

/** Looks up a previously created identity by its public key, for the signing bridge. Throws on an unknown address rather than signing for a stranger. */
export function keypairFor(publicKey: string): Keypair {
  const keypair = registry.get(publicKey);
  if (!keypair) throw new Error(`No live e2e identity registered for ${publicKey}`);
  return keypair;
}

/** A fresh keypair, funded by the local Friendbot. For any wallet that must sign and pay a fee (an investor, a refund triggerer). */
export async function createFundedIdentity(): Promise<Keypair> {
  const keypair = register(Keypair.random());
  await fundWithFriendbot(keypair.publicKey());
  return keypair;
}

/**
 * A fresh keypair, deliberately left unfunded. Only for the SME identity in
 * the "open the vault" scenario: the platform — not Friendbot — must create
 * that account (`ensureSmeAccount` in `apps/api/src/application/use-cases/open-campaign.ts`).
 */
export function createUnfundedIdentity(): Keypair {
  return register(Keypair.random());
}
