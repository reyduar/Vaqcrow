#!/usr/bin/env node
// Thin entry for `pnpm demo:preflight`: parses flags, loads an optional env
// profile, wires the Stellar SDK (from apps/api) and prints the report.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { USAGE, exitCodeFor, formatReport, parseArgs, runPreflight } from "./preflight.mjs";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(USAGE);
  process.exit(0);
}
if (options.errors.length > 0) {
  console.error(`${options.errors.join("\n")}\n\n${USAGE}`);
  process.exit(2);
}

let fileEnv = {};
if (options.envFile) {
  try {
    fileEnv = parseEnv(readFileSync(options.envFile, "utf8"));
  } catch {
    console.error(`Could not read the env file ${options.envFile}`);
    process.exit(2);
  }
}
// Shell variables win over the file, like `node --env-file`.
const env = { ...fileEnv, ...process.env };

// The Stellar SDK is a dependency of apps/api, not of the repository root.
let derivePublicKey;
let contractInstanceKey;
try {
  const sdk = createRequire(new URL("../../../apps/api/package.json", import.meta.url))("@stellar/stellar-sdk");
  derivePublicKey = (secret) => sdk.Keypair.fromSecret(secret).publicKey();
  contractInstanceKey = (contractId) =>
    sdk.xdr.LedgerKey.contractData(
      new sdk.xdr.LedgerKeyContractData({
        contract: new sdk.Address(contractId).toScAddress(),
        key: sdk.xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: sdk.xdr.ContractDataDurability.persistent
      })
    ).toXDR("base64");
} catch {
  // Left undefined: the affected checks fail with a reason (pass --platform to skip derivation).
}

const report = await runPreflight({ env, fetch, options, derivePublicKey, contractInstanceKey });
console.log(formatReport(report, { json: options.json }));
process.exit(exitCodeFor(report));
