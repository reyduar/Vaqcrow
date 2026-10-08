import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reads named keys from the repository's `.env.docker` (the docker profile,
 * `docs/architecture/environments.md` §3–§4) for the admin-review live
 * rehearsal. Only the keys a caller names are returned, the file is never
 * sourced or eval'd, and no value is ever printed: a missing key throws with
 * the key's *name* only, the same discipline as the superadmin seed script.
 *
 * `.env.docker` is gitignored and generated locally
 * (`scripts/env/generate-docker-env.sh`); nothing here writes to it.
 */
const ENV_DOCKER_PATH = fileURLToPath(new URL("../../../../.env.docker", import.meta.url));

function parseEnvFile(path: string): Map<string, string> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      "Could not read .env.docker at the repository root. Generate it first: ./scripts/env/generate-docker-env.sh --force"
    );
  }

  const values = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(match[1] ?? "", value);
  }
  return values;
}

/** The requested keys, each guaranteed non-empty; throws naming (never echoing) the first missing one. */
export function readDockerEnv<K extends string>(keys: readonly K[]): Record<K, string> {
  const values = parseEnvFile(ENV_DOCKER_PATH);
  const picked = {} as Record<K, string>;
  for (const key of keys) {
    const value = values.get(key);
    if (value === undefined || value.length === 0) {
      throw new Error(`.env.docker has no value for ${key}. Fill it in (docs/architecture/environments.md §3) and retry.`);
    }
    picked[key] = value;
  }
  return picked;
}

/** Like `readDockerEnv`, but returns `undefined` for missing keys instead of throwing (used by the Playwright config). */
export function readDockerEnvOptional<K extends string>(keys: readonly K[]): Partial<Record<K, string>> {
  let values: Map<string, string>;
  try {
    values = parseEnvFile(ENV_DOCKER_PATH);
  } catch {
    return {};
  }
  const picked: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = values.get(key);
    if (value !== undefined && value.length > 0) picked[key] = value;
  }
  return picked;
}
