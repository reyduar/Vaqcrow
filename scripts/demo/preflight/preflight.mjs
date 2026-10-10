// Read-only readiness checks for a hosted, timed demo run.
//
// Framework-free on purpose: every side effect (`fetch`, the environment, key
// derivation, XDR building) is injected, so the logic is testable without any
// real service (tests/demo-preflight.test.ts) and the CLI stays a thin wrapper.
// Nothing here writes: only GET/HEAD requests and the read-only JSON-RPC methods
// `getHealth`, `getNetwork` and `getLedgerEntries`. Secret values are never put
// in a report; only variable names, abbreviated public keys and reasons are.

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/**
 * Names whose ABSENCE breaks the hosted demo journey — not the names the API
 * needs in order to boot.
 *
 * `STELLAR_HORIZON_URL` and `STELLAR_RPC_URL` are deliberately absent: both are
 * optional and the API falls back to the canonical Testnet endpoints when they
 * are unset (see the two constants below), so a deployment without them still
 * boots and still reaches Testnet.
 *
 * `CORS_ALLOWED_ORIGINS` stays even though it is not a boot dependency either:
 * absent outside `APP_ENV=local` it resolves to an empty allow-list
 * (`apps/api/src/application/config/cors-config.ts`), which blocks the browser
 * origin and so does break the journey.
 *
 * `RESEND_API_KEY` is deliberately absent too: email is optional
 * (`apps/api/src/application/config/email-config.ts`), and the API disables it
 * rather than failing to boot. The dedicated `email` check below reports the
 * effective configuration instead of demanding a key.
 */
export const REQUIRED_API_ENV = [
  "APP_ENV",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LLM_PROVIDER",
  "LLM_MODEL",
  "LLM_VISION_MODEL",
  "LLM_API_KEY",
  "STELLAR_NETWORK",
  "STELLAR_CAMPAIGN_FACTORY_ID",
  "STELLAR_PLATFORM_SECRET_KEY",
  "CORS_ALLOWED_ORIGINS"
];

/**
 * Canonical Testnet endpoints, mirrored from
 * `apps/api/src/application/config/stellar-config.ts` (`STELLAR_TESTNET_HORIZON_URL`,
 * `STELLAR_TESTNET_RPC_URL`). The API returns these exact values when the
 * variable is unset, so the preflight probes the same endpoint the API would
 * use. Keep this pair in sync with that module.
 */
export const STELLAR_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";

/**
 * Email defaults mirrored from
 * `apps/api/src/application/config/email-config.ts` (`DEFAULT_EMAIL_FROM`,
 * `DEFAULT_APP_BASE_URL`). The API resolves these exact values when the
 * variables are unset, so the `email` check probes what the API would actually
 * use rather than restating a requirement. Keep this pair in sync with that
 * module.
 */
export const DEFAULT_EMAIL_FROM = "Vaqcrow <no-reply@vaqcrow.com>";
export const DEFAULT_APP_BASE_URL = "http://localhost:3001";

/**
 * Mirrors `EMAIL_FROM`'s validation in `email-config.ts`: a single-line display
 * name plus address, or a bare address. The explicit newline check matters
 * because `$` also matches before a trailing newline in a JS regex.
 *
 * Exported so `tests/demo-preflight.test.ts` can cross-check it against the API
 * parser: a future divergence fails the test instead of silently letting the
 * preflight pass a sender the API would reject.
 */
export function isValidEmailFrom(value) {
  if (/[\r\n]/.test(value)) return false;
  return /^(?:[^<>\r\n]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)$/.test(value);
}

/** Mirrors the absolute-http(s) check each config slice applies to a base URL. */
function isAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Names the web needs. The two Supabase names mirror
 * `apps/web/src/infrastructure/auth/supabase-auth-session.ts`
 * (`readSupabaseBrowserConfig`): the browser session cannot start without them.
 * The publishable key is browser-safe, so it is not in SECRET_ENV_NAMES.
 */
export const REQUIRED_WEB_ENV = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
];

/** Env names whose VALUES are secrets: redacted from every reported string. */
// VAQCROW_SUPERADMIN_PASSWORD is never required or read by a check (the API does
// not need it at runtime); it is listed only so it is redacted if a shell or
// profile file happens to expose it to this process.
const SECRET_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STELLAR_PLATFORM_SECRET_KEY",
  "LLM_API_KEY",
  "RESEND_API_KEY",
  "VAQCROW_SUPERADMIN_PASSWORD"
];

/** The tables the journey writes and reads (application through distribution). */
export const JOURNEY_TABLES = [
  "application_review",
  "sme_request",
  "application_assessment",
  "human_decision",
  "campaign",
  "campaign_contribution",
  "revenue_share_distribution",
  // Identity (#370): roles and the append-only audit trail.
  "profile",
  "audit_log"
];

/**
 * Minimum native balances, in XLM. Testnet XLM has no value; the floors leave
 * room for the 1 XLM base reserve, 0.5 XLM per entry and transaction fees.
 * - platform: CreateAccount of each vault (2 XLM) plus fees of the factory calls.
 * - sme: pays the revenue-share distribution (at most the campaign goal, a few
 *   XLM for the recommended small goal) plus fees.
 * - investor: the demo goal (recommended 10 XLM) plus fees and reserve.
 */
export const DEFAULT_THRESHOLDS_XLM = { platform: 10, sme: 10, investor: 20 };

const REQUEST_TIMEOUT_MS = 10_000;
const STROOPS_PER_XLM = 10_000_000n;

export const USAGE = `Usage: pnpm demo:preflight [options]

Read-only readiness check for a hosted, timed demo run. Exits 1 if any check fails.

Options:
  --env-file <path>     Load variables from a profile file (e.g. .env.cloud); the shell wins on conflicts
  --api <url>           API base URL (default: NEXT_PUBLIC_API_BASE_URL)
  --platform <G...>     Platform public key (default: derived from STELLAR_PLATFORM_SECRET_KEY)
  --sme <G...>          SME public key (default: DEMO_SME_PUBLIC_KEY)
  --investor <G...>     Investor public key, repeatable (default: DEMO_INVESTOR_PUBLIC_KEYS, comma-separated)
  --platform-min <xlm>  Minimum platform balance (default ${DEFAULT_THRESHOLDS_XLM.platform})
  --sme-min <xlm>       Minimum SME balance (default ${DEFAULT_THRESHOLDS_XLM.sme})
  --investor-min <xlm>  Minimum balance per investor (default ${DEFAULT_THRESHOLDS_XLM.investor})
  --json                Print a JSON report instead of the checklist
  --help                Show this help
`;

/**
 * @typedef {{
 *   help: boolean, json: boolean, envFile: string | undefined, api: string | undefined,
 *   platform: string | undefined, sme: string | undefined, investors: string[],
 *   thresholdsXlm: { platform: number, sme: number, investor: number }, errors: string[]
 * }} PreflightOptions
 */

/**
 * @param {string[]} argv
 * @returns {PreflightOptions}
 */
export function parseArgs(argv) {
  /** @type {PreflightOptions} */
  const options = {
    help: false,
    json: false,
    envFile: undefined,
    api: undefined,
    platform: undefined,
    sme: undefined,
    investors: [],
    thresholdsXlm: { ...DEFAULT_THRESHOLDS_XLM },
    errors: []
  };
  const valueFlags = new Set([
    "--env-file",
    "--api",
    "--platform",
    "--sme",
    "--investor",
    "--platform-min",
    "--sme-min",
    "--investor-min"
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help" || flag === "-h") {
      options.help = true;
    } else if (flag === "--json") {
      options.json = true;
    } else if (valueFlags.has(flag)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        options.errors.push(`${flag} needs a value`);
        continue;
      }
      index += 1;
      if (flag === "--env-file") options.envFile = value;
      else if (flag === "--api") options.api = value;
      else if (flag === "--platform") options.platform = value;
      else if (flag === "--sme") options.sme = value;
      else if (flag === "--investor") options.investors.push(value);
      else {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) {
          options.errors.push(`${flag} must be a positive number`);
        } else {
          options.thresholdsXlm[flag.slice(2, -4)] = amount;
        }
      }
    } else {
      options.errors.push(`Unknown option: ${flag}`);
    }
  }
  return options;
}

const abbreviate = (key) => (key.length > 10 ? `${key.slice(0, 4)}…${key.slice(-4)}` : key);
const isPresent = (value) => typeof value === "string" && value.trim() !== "";
const trimSlash = (url) => url.replace(/\/+$/, "");

/** Decimal XLM string (up to 7 places) to stroops; NaN-safe via null. */
function toStroops(decimal) {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(String(decimal));
  if (!match) return null;
  return BigInt(match[1]) * STROOPS_PER_XLM + BigInt((match[2] ?? "").padEnd(7, "0"));
}
const xlmToStroops = (xlm) => BigInt(Math.round(xlm * Number(STROOPS_PER_XLM)));

function makeRedactor(env) {
  const secrets = SECRET_ENV_NAMES.map((name) => env[name]).filter(isPresent);
  return (text) => secrets.reduce((acc, secret) => acc.split(secret).join("[redacted]"), String(text));
}

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 100 ? `${message.slice(0, 100)}…` : message;
}

/**
 * Runs one check body; a thrown error becomes a failed check so one red item
 * never aborts the others.
 */
async function check(id, label, body, redact) {
  try {
    const { ok, detail } = await body();
    return { id, label, status: ok ? "pass" : "fail", detail: redact(detail) };
  } catch (error) {
    return { id, label, status: "fail", detail: redact(describeError(error)) };
  }
}

/**
 * @param {{
 *   env: Record<string, string | undefined>,
 *   fetch: typeof fetch,
 *   options: ReturnType<typeof parseArgs>,
 *   derivePublicKey?: (secret: string) => string,
 *   contractInstanceKey?: (contractId: string) => string
 * }} deps
 */
export async function runPreflight({ env, fetch: fetchFn, options, derivePublicKey, contractInstanceKey }) {
  const redact = makeRedactor(env);
  const get = (name) => (isPresent(env[name]) ? env[name].trim() : undefined);
  const timeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const rpcCall = async (method, params) => {
    const response = await fetchFn(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
      signal: timeout()
    });
    if (!response.ok) throw new Error(`RPC ${method} answered HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(`RPC ${method} returned an error`);
    return body.result;
  };

  const apiBase = options.api ?? get("NEXT_PUBLIC_API_BASE_URL");
  // Both endpoints are optional: when unset, probe the canonical Testnet
  // endpoint the API itself would use, and say so in the check detail.
  const horizonConfigured = get("STELLAR_HORIZON_URL");
  const rpcConfigured = get("STELLAR_RPC_URL");
  const horizon = horizonConfigured ?? STELLAR_TESTNET_HORIZON_URL;
  const rpc = rpcConfigured ?? STELLAR_TESTNET_RPC_URL;
  const horizonSource = horizonConfigured ? "" : ` (canonical Testnet default ${horizon}; STELLAR_HORIZON_URL unset)`;
  const rpcSource = rpcConfigured ? "" : ` (canonical Testnet default ${rpc}; STELLAR_RPC_URL unset)`;
  const supabaseUrl = get("SUPABASE_URL");
  const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");

  const missingNames = (names) => names.filter((name) => !isPresent(env[name]));

  const checks = [];

  // 1. Environment names (never values).
  checks.push(
    await check(
      "env-api",
      "API environment variables",
      () => {
        const missing = missingNames(REQUIRED_API_ENV);
        const pair = ["STELLAR_CAMPAIGN_FACTORY_ID", "STELLAR_PLATFORM_SECRET_KEY"];
        const pairMissing = missingNames(pair);
        const note =
          pairMissing.length === 1 ? ` (${pair.join(" + ")} must be configured together)` : "";
        return {
          ok: missing.length === 0,
          detail: missing.length === 0 ? `${REQUIRED_API_ENV.length} names present` : `missing: ${missing.join(", ")}${note}`
        };
      },
      redact
    )
  );
  checks.push(
    await check(
      "env-web",
      "Web environment variables",
      () => {
        const missing = missingNames(REQUIRED_WEB_ENV);
        return {
          ok: missing.length === 0,
          detail: missing.length === 0 ? `${REQUIRED_WEB_ENV.join(", ")} present` : `missing: ${missing.join(", ")}`
        };
      },
      redact
    )
  );

  // 1b. Transactional email. The API treats the Resend key as optional and
  // disables email when it is unset, so an absent key is a valid configuration
  // and this check reports it rather than failing. Present values are validated
  // exactly as `email-config.ts` does, so a value the API would reject fails
  // the run.
  checks.push(
    await check(
      "email",
      "Transactional email (Resend) configuration",
      () => {
        const key = get("RESEND_API_KEY");
        const from = get("EMAIL_FROM") ?? DEFAULT_EMAIL_FROM;
        // Normalised exactly as `email-config.ts` does: a base that kept its
        // trailing slash would report a value the API would have stripped.
        const base = trimSlash(get("APP_BASE_URL") ?? DEFAULT_APP_BASE_URL);

        if (!isValidEmailFrom(from)) {
          return {
            ok: false,
            detail: 'EMAIL_FROM must be a single-line address such as "Vaqcrow <no-reply@vaqcrow.com>"'
          };
        }
        if (!isAbsoluteHttpUrl(base)) {
          return { ok: false, detail: "APP_BASE_URL must be an absolute http(s) URL" };
        }
        if (!key) {
          return {
            ok: true,
            detail: `email disabled: RESEND_API_KEY unset (from ${from}, links ${base})`
          };
        }
        return { ok: true, detail: `enabled (from ${from}, links ${base})` };
      },
      redact
    )
  );

  // 2. API, Horizon, RPC, factory (independent: run together).
  const services = await Promise.all([
    check(
      "api-health",
      "API GET /health",
      async () => {
        if (!apiBase) return { ok: false, detail: "no API URL (set NEXT_PUBLIC_API_BASE_URL or --api)" };
        const response = await fetchFn(`${trimSlash(apiBase)}/health`, { signal: timeout() });
        return { ok: response.status === 200, detail: `HTTP ${response.status}` };
      },
      redact
    ),
    check(
      "horizon",
      "Horizon reachable, Testnet",
      async () => {
        const response = await fetchFn(`${trimSlash(horizon)}/`, { signal: timeout() });
        if (!response.ok) return { ok: false, detail: `HTTP ${response.status}${horizonSource}` };
        const body = await response.json();
        return body.network_passphrase === TESTNET_PASSPHRASE
          ? { ok: true, detail: `HTTP 200, Testnet passphrase${horizonSource}` }
          : { ok: false, detail: `network passphrase is not Testnet${horizonSource}` };
      },
      redact
    ),
    check(
      "rpc",
      "Soroban RPC healthy, Testnet",
      async () => {
        const health = await rpcCall("getHealth");
        if (health?.status !== "healthy") {
          return { ok: false, detail: `getHealth status: ${health?.status ?? "unknown"}${rpcSource}` };
        }
        const network = await rpcCall("getNetwork");
        return network?.passphrase === TESTNET_PASSPHRASE
          ? { ok: true, detail: `healthy, Testnet passphrase${rpcSource}` }
          : { ok: false, detail: `network passphrase is not Testnet${rpcSource}` };
      },
      redact
    ),
    check(
      "factory",
      "Campaign factory contract exists",
      async () => {
        const factoryId = get("STELLAR_CAMPAIGN_FACTORY_ID");
        if (!factoryId) return { ok: false, detail: "STELLAR_CAMPAIGN_FACTORY_ID is not set" };
        if (!contractInstanceKey) return { ok: false, detail: "cannot build the ledger key (Stellar SDK unavailable)" };
        const result = await rpcCall("getLedgerEntries", { keys: [contractInstanceKey(factoryId)] });
        const found = Array.isArray(result?.entries) && result.entries.length > 0;
        return { ok: found, detail: found ? `${abbreviate(factoryId)} instance found` : `${abbreviate(factoryId)} instance not found` };
      },
      redact
    )
  ]);
  checks.push(...services);

  // 3. Accounts.
  const accountCheck = (id, label, publicKey, minXlm) =>
    check(
      id,
      label,
      async () => {
        const response = await fetchFn(`${trimSlash(horizon)}/accounts/${publicKey}`, { signal: timeout() });
        if (response.status === 404) return { ok: false, detail: `${abbreviate(publicKey)} not found on Horizon (unfunded)` };
        if (!response.ok) return { ok: false, detail: `${abbreviate(publicKey)}: Horizon HTTP ${response.status}` };
        const body = await response.json();
        const native = (body.balances ?? []).find((balance) => balance.asset_type === "native");
        const stroops = native ? toStroops(native.balance) : null;
        if (stroops === null) return { ok: false, detail: `${abbreviate(publicKey)} has no native balance` };
        const enough = stroops >= xlmToStroops(minXlm);
        return {
          ok: enough,
          detail: `${abbreviate(publicKey)} ${enough ? "holds" : "holds less than"} ${minXlm} XLM minimum`
        };
      },
      redact
    );
  const roleMissing = (id, label, detail) => ({ id, label, status: "fail", detail });

  let platformKey = options.platform;
  let platformProblem;
  if (!platformKey) {
    const secret = get("STELLAR_PLATFORM_SECRET_KEY");
    if (!secret) platformProblem = "no platform account (set STELLAR_PLATFORM_SECRET_KEY or --platform)";
    else if (!derivePublicKey) platformProblem = "cannot derive the public key (Stellar SDK unavailable); pass --platform";
    else {
      try {
        platformKey = derivePublicKey(secret);
      } catch {
        platformProblem = "could not derive a public key from STELLAR_PLATFORM_SECRET_KEY";
      }
    }
  }

  const smeKey = options.sme ?? get("DEMO_SME_PUBLIC_KEY");
  const investorKeys =
    options.investors.length > 0
      ? options.investors
      : (get("DEMO_INVESTOR_PUBLIC_KEYS") ?? "")
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean);

  const { thresholdsXlm } = options;
  checks.push(
    platformKey
      ? await accountCheck("account-platform", "Platform account funded", platformKey, thresholdsXlm.platform)
      : roleMissing("account-platform", "Platform account funded", platformProblem)
  );
  checks.push(
    smeKey
      ? await accountCheck("account-sme", "SME account funded", smeKey, thresholdsXlm.sme)
      : roleMissing("account-sme", "SME account funded", "no SME account (pass --sme or set DEMO_SME_PUBLIC_KEY)")
  );
  if (investorKeys.length === 0) {
    checks.push(
      roleMissing(
        "account-investor",
        "Investor account(s) funded",
        "no investor account (pass --investor or set DEMO_INVESTOR_PUBLIC_KEYS)"
      )
    );
  } else {
    const results = await Promise.all(
      investorKeys.map((key) => accountCheck("account-investor", "Investor account funded", key, thresholdsXlm.investor))
    );
    const failed = results.filter((result) => result.status === "fail");
    checks.push({
      id: "account-investor",
      label: "Investor account(s) funded",
      status: failed.length === 0 ? "pass" : "fail",
      detail: (failed.length === 0 ? results : failed).map((result) => result.detail).join("; ")
    });
  }

  // 4. Remote schema, read-only (HEAD with the service key; the key is only a header).
  const head = async (query) => {
    const response = await fetchFn(`${trimSlash(supabaseUrl)}/rest/v1/${query}`, {
      method: "HEAD",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: timeout()
    });
    return response.status;
  };
  const schemaUnavailable = !supabaseUrl || !serviceKey ? "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set" : undefined;

  checks.push(
    schemaUnavailable
      ? roleMissing("schema-tables", "Remote schema has the journey tables", schemaUnavailable)
      : await check(
          "schema-tables",
          "Remote schema has the journey tables",
          async () => {
            const statuses = await Promise.all(JOURNEY_TABLES.map(async (table) => [table, await head(`${table}?select=*&limit=0`)]));
            const bad = statuses.filter(([, status]) => status !== 200 && status !== 206);
            return {
              ok: bad.length === 0,
              detail:
                bad.length === 0
                  ? `${JOURNEY_TABLES.length} tables readable`
                  : `not readable: ${bad.map(([table, status]) => `${table} (HTTP ${status})`).join(", ")}`
            };
          },
          redact
        )
  );
  checks.push(
    schemaUnavailable
      ? roleMissing("schema-distribution-columns", "revenue_share_distribution has campaign_id and period", schemaUnavailable)
      : await check(
          "schema-distribution-columns",
          "revenue_share_distribution has campaign_id and period",
          async () => {
            const status = await head("revenue_share_distribution?select=campaign_id,period&limit=0");
            const ok = status === 200 || status === 206;
            return { ok, detail: ok ? "both columns selectable" : `select of campaign_id,period answered HTTP ${status} (migration missing?)` };
          },
          redact
        )
  );

  // 5. Seeded super admin: at least one active ADMIN profile (service-role read, one row).
  checks.push(
    schemaUnavailable
      ? roleMissing("admin-profile", "An active ADMIN profile exists", schemaUnavailable)
      : await check(
          "admin-profile",
          "An active ADMIN profile exists",
          async () => {
            const response = await fetchFn(
              `${trimSlash(supabaseUrl)}/rest/v1/profile?select=user_id&role=eq.ADMIN&status=eq.active&limit=1`,
              { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: timeout() }
            );
            if (!response.ok) return { ok: false, detail: `profile query answered HTTP ${response.status} (migration missing?)` };
            const rows = await response.json();
            const found = Array.isArray(rows) && rows.length > 0;
            return {
              ok: found,
              detail: found
                ? "an active ADMIN profile found"
                : "no active ADMIN profile; run pnpm --filter @vaqcrow/api seed:superadmin:<docker|cloud>"
            };
          },
          redact
        )
  );

  return { ok: checks.every((item) => item.status === "pass"), checks };
}

export const exitCodeFor = (report) => (report.ok ? 0 : 1);

/** @param {{ ok: boolean, checks: { id: string, label: string, status: string, detail: string }[] }} report */
export function formatReport(report, { json }) {
  if (json) return JSON.stringify(report, null, 2);
  const lines = report.checks.map((item) => `${item.status === "pass" ? "✔" : "✖"} ${item.label} — ${item.detail}`);
  const failed = report.checks.filter((item) => item.status !== "pass").length;
  lines.push("", failed === 0 ? "Ready: every check passed." : `Not ready: ${failed} check(s) failed.`);
  return lines.join("\n");
}
