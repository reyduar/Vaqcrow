import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildOpenApi } from "./build-openapi.js";

/**
 * Writes the OpenAPI document to `apps/api/openapi.json` (the package root).
 * Run through `pnpm --filter @vaqcrow/api run openapi:generate`, which compiles
 * the API first and then executes this file from `dist/`. The output is a
 * committed artifact and a test fails if it drifts from the generator.
 */
const OUT = fileURLToPath(new URL("../../../../openapi.json", import.meta.url));

const document = buildOpenApi();
writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`);
// eslint-disable-next-line no-console -- a build-time CLI; the count is its only output.
console.log(`openapi.json written: ${Object.keys(document.paths).length} paths`);
