import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Feature #23 promises that no private key path exists: Freighter signs in the
 * browser, and Vaqcrow only ever handles public addresses and transaction XDR.
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

const APP_SRC_ROOTS = [
  fileURLToPath(new URL("../apps/web/src", import.meta.url)),
  fileURLToPath(new URL("../apps/api/src", import.meta.url))
];

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
        if (!(options.allowEphemeralSigners && member === "random")) {
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
  it("handles no key material anywhere in apps/web/src or apps/api/src", () => {
    const offences = APP_SOURCE_FILES.flatMap(({ root, file }) =>
      offencesIn(relative(root, file), readFileSync(file, "utf8"), {
        allowEphemeralSigners: TEST_FILE.test(file)
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
