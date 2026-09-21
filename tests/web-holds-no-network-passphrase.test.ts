import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Decision A (`D1`) promises that the web never holds its own copy of the
 * network identity: every signature is requested with the passphrase the
 * prepare response returned, so the browser cannot drift from the backend.
 *
 * That is a property of the source rather than of a runtime check, so it is
 * enforced by reading the source. No `apps/web/src` file may contain the
 * Testnet or Mainnet passphrase literal, nor any string shaped like a Stellar
 * network passphrase — a hardcoded stand-in would be exactly the second source
 * of truth `D1` rejects. The scan is unconditional: there is no allowance for
 * tests either, because a wallet double needs two *distinct* passphrases, not
 * the real ones, and the web cannot even import `Networks` to make the real
 * value meaningful.
 *
 * The scan walks the TypeScript AST instead of the raw text, for the same
 * reason `tests/stellar-non-custody.test.ts` does: the field name
 * `networkPassphrase` legitimately appears all over the web adapter, port and
 * state hook, and a text scan would flag every mention while proving nothing.
 * The AST sees string values, which is where a passphrase could actually hide.
 *
 * Note: `tests/**` is executed by `pnpm run test:boundaries` but sits outside
 * `turbo run lint` and `turbo run typecheck` (there is no root tsconfig), so
 * this file gets no static analysis. Keep it explicit.
 */

const WEB_SRC = fileURLToPath(new URL("../apps/web/src", import.meta.url));

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

/** The shape of a Stellar network passphrase: `<name> ; <Month> <year>`. */
const PASSPHRASE_SHAPE = /^[A-Za-z][A-Za-z0-9 ]{0,60} ; [A-Z][a-z]+ \d{4}$/;

export interface PassphraseOffence {
  readonly file: string;
  readonly detail: string;
}

/** A passphrase value this source text would hold as a string literal. */
export function passphraseOffencesIn(file: string, text: string): readonly PassphraseOffence[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: PassphraseOffence[] = [];

  const report = (detail: string, node: ts.Node): void => {
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push({ file, detail: `${detail} at line ${position.line + 1}` });
  };

  const check = (value: string, node: ts.Node): void => {
    if (value === TESTNET_PASSPHRASE) report("Testnet network passphrase literal", node);
    else if (value === MAINNET_PASSPHRASE) report("Mainnet network passphrase literal", node);
    else if (PASSPHRASE_SHAPE.test(value)) report(`passphrase-shaped literal "${value}"`, node);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      check(node.text, node);
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

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

const WEB_SOURCE_FILES = sourceFiles(WEB_SRC);

describe("the scanner itself", () => {
  it("flags the Testnet passphrase literal", () => {
    const offences = passphraseOffencesIn("probe.ts", `const passphrase = "${TESTNET_PASSPHRASE}";`);

    expect(offences).toHaveLength(1);
    expect(offences[0]?.detail).toContain("Testnet network passphrase literal");
  });

  it("flags the Mainnet passphrase literal", () => {
    const offences = passphraseOffencesIn("probe.ts", `sign(xdr, "${MAINNET_PASSPHRASE}");`);

    expect(offences).toHaveLength(1);
    expect(offences[0]?.detail).toContain("Mainnet network passphrase literal");
  });

  it("flags a passphrase-shaped literal that is not one of the two known passphrases", () => {
    const offences = passphraseOffencesIn("probe.ts", 'const p = "Standalone Network ; February 2017";');

    expect(offences).toHaveLength(1);
    expect(offences[0]?.detail).toContain("passphrase-shaped");
  });

  it("flags a passphrase in a template literal too", () => {
    expect(passphraseOffencesIn("probe.ts", `const p = \`${TESTNET_PASSPHRASE}\`;`)).toHaveLength(1);
  });

  it("does not flag the field name or ordinary network strings", () => {
    const text = [
      "interface Config { networkPassphrase: string }",
      'const network = "TESTNET";',
      'const passphrase = "synthetic-wallet-passphrase";',
      "// The passphrase comes from the response and is never hardcoded here."
    ].join("\n");

    expect(passphraseOffencesIn("probe.ts", text)).toEqual([]);
  });
});

describe("the scanned surface", () => {
  it("covers the real web sources, so a clean result means something", () => {
    // A scanner pointed at an empty tree reports success too. These files are
    // where a passphrase would appear if it ever appeared.
    const names = WEB_SOURCE_FILES.map((file) => basename(file));

    expect(WEB_SOURCE_FILES.length).toBeGreaterThan(60);
    expect(names).toContain("freighter-wallet.ts");
    expect(names).toContain("funding-workspace.tsx");
    expect(names).toContain("use-funding-intent.ts");
    expect(names).toContain("http-funding-intent-gateway.ts");
  });
});

describe("the web holds no network passphrase", () => {
  it("names no passphrase literal anywhere in apps/web/src", () => {
    const offences = WEB_SOURCE_FILES.flatMap((file) =>
      passphraseOffencesIn(relative(WEB_SRC, file), readFileSync(file, "utf8"))
    );

    expect(
      offences,
      `a network passphrase appears in web source: ${offences
        .map((offence) => `${offence.file}: ${offence.detail}`)
        .join("; ")}. ` +
        "Decision A gives the API the network identity: the web signs with the passphrase the " +
        "prepare response returns, so it must never own one of its own — not even as a test fixture."
    ).toEqual([]);
  });
});
