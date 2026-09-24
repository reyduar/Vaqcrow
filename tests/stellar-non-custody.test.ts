import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Feature #23 promises that no private key path exists: Freighter signs in the
 * browser, and Vaqcrow only ever handles public addresses and transaction XDR.
 *
 * That guarantee did not change with the campaign vault (#247, D8): Vaqcrow
 * still never handles a user's key. What changed is that the *platform*
 * itself now needs one operational key of its own — it owns the campaign
 * factory and has to sign `CreateAccount` (funding the SME's own account, D2)
 * and `factory.deploy()` (opening the vault). That key is not a user's key,
 * it never leaves the API process, and it is confined to exactly one audited
 * file, `apps/api/src/infrastructure/adapters/platform-signer.ts`
 * ({@link PLATFORM_SIGNER_FILES}) — the scan below admits `Keypair.fromSecret`
 * there and nowhere else, and every other rule (secret-bearing identifiers,
 * seed literals) stays exactly as strict inside that file too.
 *
 * That is a property of the code rather than of a runtime check, so it is
 * enforced by reading the source. The scan walks the TypeScript AST instead of
 * the raw text, because the text legitimately mentions these names — the
 * redaction heuristic lists `privatekey`/`mnemonic` as key names to mask, and
 * the wallet adapter's own documentation says it never asks for a seed. A text
 * scan would flag both and prove nothing; an AST scan sees only code.
 *
 * Note: `tests/**` is executed by `pnpm run test:boundaries` but sits outside
 * `turbo run lint` and `turbo run typecheck` (there is no root tsconfig), so
 * this file gets no static analysis. Keep it explicit.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const APP_SRC_ROOTS = [
  fileURLToPath(new URL("../apps/web/src", import.meta.url)),
  fileURLToPath(new URL("../apps/api/src", import.meta.url))
];

/**
 * The one production file allowed to turn the platform's own `Secret` into a
 * signing key (D8). Repo-relative, so it reads the same way the `Rama
 * propuesta` lines in `docs/planning/demo-tasks-list.md` do. Exactly one
 * entry on purpose: widening this list is a deliberate, reviewable act, never
 * an accident of a refactor that happens to add a second file.
 */
const PLATFORM_SIGNER_FILES: readonly string[] = ["apps/api/src/infrastructure/adapters/platform-signer.ts"];

/**
 * `Keypair` members that create or expose a signing key. `fromPublicKey` is
 * deliberately absent: verifying a signature against a public key is legitimate
 * and belongs to the funding-intent work (#24).
 */
const KEYPAIR_SECRET_MEMBERS = new Set(["fromSecret", "fromRawEd25519Seed", "random", "master"]);

/** Names that denote key material wherever they appear as code. */
const SECRET_BEARING_NAMES = new Set([
  "secretKey",
  "secret_key",
  "privateKey",
  "private_key",
  "mnemonic",
  "seedPhrase",
  "seed_phrase",
  "recoveryPhrase",
  "recovery_phrase"
]);

/** The same shape `redaction.ts` masks: `S` followed by 55 base32 characters. */
const STELLAR_SEED = /^S[A-Z2-7]{55}$/;

export interface Offence {
  readonly file: string;
  readonly detail: string;
}

/**
 * `allowEphemeralSigners` is the only concession this scan makes, and it is
 * opt-in per file. A test proves a cryptographic property with an in-memory
 * keypair that never touches a real account and is never persisted, so
 * `Keypair.random()` is legitimate there. Everything else — a hardcoded seed
 * literal, a secret-bearing identifier, `fromSecret` — stays flagged in test
 * files too, because a fixture is as much a place for a leaked key as shipped
 * code is.
 */
export interface ScanOptions {
  readonly allowEphemeralSigners?: boolean;
  /**
   * The narrow D8 concession: `Keypair.fromSecret` is not flagged in this one
   * call. Opt-in per file, exactly like `allowEphemeralSigners` — the caller
   * decides which file this is true for, `offencesIn` itself trusts nothing
   * about the `file` name it is given. Every other secret-bearing shape
   * (an identifier named `secretKey`, a hardcoded seed literal, `Keypair.random`
   * outside a test) stays flagged even here.
   */
  readonly allowPlatformSigner?: boolean;
}

/** Key material this source text would handle, as code — comments and prose are invisible to it. */
export function offencesIn(file: string, text: string, options: ScanOptions = {}): readonly Offence[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: Offence[] = [];

  const report = (detail: string, node: ts.Node): void => {
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push({ file, detail: `${detail} at line ${position.line + 1}` });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node)) {
      const member = node.name.text;

      if (KEYPAIR_SECRET_MEMBERS.has(member) && ts.isIdentifier(node.expression) && node.expression.text === "Keypair") {
        const allowed =
          (options.allowEphemeralSigners && member === "random") ||
          (options.allowPlatformSigner && member === "fromSecret");

        if (!allowed) {
          report(`Keypair.${member}`, node);
        }
      }

      if (SECRET_BEARING_NAMES.has(member)) {
        report(`.${member}`, node);
      }
    }

    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
      if (SECRET_BEARING_NAMES.has(node.argumentExpression.text)) {
        report(`["${node.argumentExpression.text}"]`, node);
      }
    }

    if (ts.isIdentifier(node) && SECRET_BEARING_NAMES.has(node.text)) {
      report(`identifier \`${node.text}\``, node);
    }

    if (ts.isStringLiteral(node) && STELLAR_SEED.test(node.text)) {
      report("Stellar secret seed literal", node);
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

/**
 * Test files are scanned like any other source file — a hardcoded seed in a
 * fixture is as much a leak as one in shipped code. The only difference is that
 * they opt in to ephemeral signers (see `ScanOptions`).
 */
const TEST_FILE = /\.test\.tsx?$/;

function sourceFiles(root: string): readonly string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (/\.tsx?$/.test(entry.name)) {
        found.push(path);
      }
    }
  };

  walk(root);
  return found;
}

const APP_SOURCE_FILES = APP_SRC_ROOTS.flatMap((root) => sourceFiles(root).map((file) => ({ root, file })));

describe("the scanner itself", () => {
  it("flags a Keypair call that creates a key from a secret", () => {
    const offences = offencesIn("probe.ts", 'const pair = Keypair.fromSecret("not-a-real-seed");');

    expect(offences).toHaveLength(1);
    expect(offences[0]?.detail).toContain("Keypair.fromSecret");
  });

  it("flags a Keypair call that generates a new key", () => {
    expect(offencesIn("probe.ts", "const pair = Keypair.random();")).toHaveLength(1);
  });

  it("allows an ephemeral signer only where the caller opts in for it", () => {
    // Shipped code never generates key material, so the default stays strict.
    expect(offencesIn("probe.ts", "const pair = Keypair.random();")).toHaveLength(1);
    expect(
      offencesIn("probe.test.ts", "const pair = Keypair.random();", { allowEphemeralSigners: true })
    ).toEqual([]);
  });

  it("still flags Keypair.fromSecret outside the platform signer allowlist, ephemeral or not", () => {
    const code = 'const pair = Keypair.fromSecret("not-a-real-seed");';

    expect(offencesIn("probe.ts", code).some((offence) => offence.detail.includes("Keypair.fromSecret"))).toBe(
      true
    );
    // `allowEphemeralSigners` (a test-file concession) and `allowPlatformSigner`
    // (a one-file concession) are independent switches: a test file gets no
    // free pass on `fromSecret` just because it opted in to `Keypair.random()`.
    expect(
      offencesIn("probe.test.ts", code, { allowEphemeralSigners: true }).some((offence) =>
        offence.detail.includes("Keypair.fromSecret")
      )
    ).toBe(true);
  });

  it("allows Keypair.fromSecret only where the caller opts in as the platform signer", () => {
    const code = "const signingKey = Keypair.fromSecret(platformKey.reveal());";

    expect(offencesIn("platform-signer.ts", code, { allowPlatformSigner: true })).toEqual([]);
    expect(
      offencesIn("platform-signer.ts", code).some((offence) => offence.detail.includes("Keypair.fromSecret"))
    ).toBe(true);
  });

  it("still flags every other key-material shape in a test file", () => {
    // The ephemeral allowance is narrow on purpose: a test is a place a leaked
    // key can hide just as easily as shipped code.
    const options = { allowEphemeralSigners: true } as const;
    const seed = "SUJZDEGXDNCF32EPF3DHODZDOCIS2JHTLGMXGEDN73U55XTPLPFT7V4S";

    expect(
      offencesIn("probe.test.ts", `const pair = Keypair.fromSecret("${seed}");`, options).some((offence) =>
        offence.detail.includes("Keypair.fromSecret")
      )
    ).toBe(true);
    expect(
      offencesIn("probe.test.ts", `const leaked = "${seed}";`, options).some(
        (offence) => offence.detail === "Stellar secret seed literal at line 1"
      )
    ).toBe(true);
    expect(offencesIn("probe.test.ts", "const privateKey = readFromDisk();", options).length).toBeGreaterThanOrEqual(1);
  });

  it("flags a hardcoded Stellar secret seed", () => {
    const offences = offencesIn(
      "probe.ts",
      'const seed = "SUJZDEGXDNCF32EPF3DHODZDOCIS2JHTLGMXGEDN73U55XTPLPFT7V4S";'
    );

    expect(offences.some((offence) => offence.detail === "Stellar secret seed literal at line 1")).toBe(true);
  });

  it("flags an identifier that holds key material", () => {
    expect(offencesIn("probe.ts", "const privateKey = readFromDisk();").length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag verifying against a public key, which #24 needs", () => {
    expect(offencesIn("probe.ts", 'const pair = Keypair.fromPublicKey("G...");')).toEqual([]);
  });

  it("does not flag prose or a redaction pattern that names these keys", () => {
    const text = [
      "// The adapter never asks for a seed, mnemonic or private key.",
      "/** Key material: secretKey, privateKey, mnemonic. */",
      "const SENSITIVE = /secret|privatekey|mnemonic|seed/;"
    ].join("\n");

    expect(offencesIn("probe.ts", text)).toEqual([]);
  });
});

describe("the platform signer allowlist", () => {
  it("has exactly one entry", () => {
    expect(PLATFORM_SIGNER_FILES).toHaveLength(1);
  });

  it("points at a file that actually exists", () => {
    const [entry] = PLATFORM_SIGNER_FILES;
    expect(entry).toBeDefined();
    expect(existsSync(join(REPO_ROOT, entry as string))).toBe(true);
  });
});

describe("the scanned surface", () => {
  it("covers the real Stellar sources, so a clean result means something", () => {
    // A scanner pointed at an empty tree reports success too. These two files
    // are where key material would appear if it ever appeared.
    const names = APP_SOURCE_FILES.map(({ file }) => basename(file));

    expect(APP_SOURCE_FILES.length).toBeGreaterThan(40);
    expect(names).toContain("stellar-ledger.ts");
    expect(names).toContain("freighter-wallet.ts");
  });
});

describe("no private key path exists", () => {
  it("handles no key material anywhere in apps/web/src or apps/api/src, except the one audited platform signer", () => {
    const offences = APP_SOURCE_FILES.flatMap(({ root, file }) =>
      offencesIn(relative(root, file), readFileSync(file, "utf8"), {
        allowEphemeralSigners: TEST_FILE.test(file),
        allowPlatformSigner: PLATFORM_SIGNER_FILES.includes(relative(REPO_ROOT, file))
      })
    );

    expect(
      offences,
      `key material appears in application source: ${offences
        .map((offence) => `${offence.file}: ${offence.detail}`)
        .join("; ")}. ` +
        "Freighter signs in the browser and the server only ever sees public data, so no " +
        "application code should be able to obtain, hold or use a private key."
    ).toEqual([]);
  });
});
