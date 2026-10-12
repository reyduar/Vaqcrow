#!/usr/bin/env node
// Decode a Testnet transaction from its hash, read-only and secret-free.
//
// Fetches the transaction envelope from Horizon Testnet and decodes it with
// @stellar/stellar-sdk into a structured JSON artifact (source, fee,
// operations, Soroban invoke + auth tree, envelope XDR). No keys, no writes
// to any remote system; only a public GET against Horizon.
//
// Usage (from apps/api, so `@stellar/stellar-sdk` resolves):
//   node ../../scripts/demo/rehearsal/decode-testnet-tx.mjs <txHash> [outPath]
//
// If `outPath` is given, the JSON is written there; otherwise it is printed.

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The script lives outside the API workspace, so a bare `import
// "@stellar/stellar-sdk"` would not resolve. Anchor a CommonJS require at the
// API workspace's own package.json (same pattern as hosted-rehearsal.mjs).
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiRequire = createRequire(path.resolve(scriptDir, "../../../apps/api/package.json"));
const { TransactionBuilder, Networks } = apiRequire("@stellar/stellar-sdk");

const HORIZON = "https://horizon-testnet.stellar.org";

const [, , hash, outPath] = process.argv;
if (!hash) {
  console.error("usage: node decode-testnet-tx.mjs <txHash> [outPath]");
  process.exit(2);
}

const res = await fetch(`${HORIZON}/transactions/${hash}`);
if (!res.ok) {
  console.error(`FAILED: GET /transactions/${hash} -> HTTP ${res.status}`);
  process.exit(1);
}

const record = await res.json();
const tx = TransactionBuilder.fromXDR(record.envelope_xdr, Networks.TESTNET);

const decoded = {
  hash: record.hash,
  ledger: record.ledger,
  created_at: record.created_at,
  successful: record.successful,
  source: tx.source,
  fee: tx.fee,
  operationCount: tx.operations.length,
  operations: tx.operations,
  envelopeXdr: record.envelope_xdr,
  explorer: `https://stellar.expert/explorer/testnet/tx/${record.hash}`,
};

const json = JSON.stringify(decoded, null, 2) + "\n";
if (outPath) {
  writeFileSync(outPath, json);
  console.error(`wrote ${outPath}`);
} else {
  process.stdout.write(json);
}
