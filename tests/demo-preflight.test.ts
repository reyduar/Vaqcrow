import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THRESHOLDS_XLM,
  REQUIRED_API_ENV,
  REQUIRED_WEB_ENV,
  JOURNEY_TABLES,
  STELLAR_TESTNET_HORIZON_URL,
  STELLAR_TESTNET_RPC_URL,
  exitCodeFor,
  formatReport,
  parseArgs,
  runPreflight
} from "../scripts/demo/preflight/preflight.mjs";

const TESTNET = "Test SDF Network ; September 2015";
const SECRET = "SSECRETSECRETSECRETSECRETSECRETSECRETSECRETSECRET0000";
const SERVICE_KEY = "service-role-key-never-printed";
const LLM_KEY = "llm-key-never-printed";
const PLATFORM = "GPLATFORMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SME = "GSMEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const INVESTOR = "GINVESTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const FACTORY = "CFACTORYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const API = "https://api.example.test";
const HORIZON = "https://horizon.example.test";
const RPC = "https://rpc.example.test";
const SUPABASE = "https://ref.supabase.example.test";
// The canonical Testnet endpoints the API falls back to when the variables are
// unset (`apps/api/src/application/config/stellar-config.ts`).
const CANONICAL_HORIZON = "https://horizon-testnet.stellar.org";
const CANONICAL_RPC = "https://soroban-testnet.stellar.org";

const env = {
  APP_ENV: "demo",
  SUPABASE_URL: SUPABASE,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  LLM_PROVIDER: "openai",
  LLM_MODEL: "model",
  LLM_API_KEY: LLM_KEY,
  STELLAR_NETWORK: "testnet",
  STELLAR_HORIZON_URL: HORIZON,
  STELLAR_RPC_URL: RPC,
  STELLAR_CAMPAIGN_FACTORY_ID: FACTORY,
  STELLAR_PLATFORM_SECRET_KEY: SECRET,
  CORS_ALLOWED_ORIGINS: "https://web.example.test",
  NEXT_PUBLIC_API_BASE_URL: API,
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
};

const options = parseArgs(["--sme", SME, "--investor", INVESTOR]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** A fetch double: routes by exact URL (+ JSON-RPC method), every unhandled call is a test failure. */
function fetchDouble(overrides: Record<string, Handler> = {}) {
  const account = (xlm: string) => json({ balances: [{ asset_type: "native", balance: xlm }] });
  // Both the configured and the canonical Testnet bases are routable, so a test
  // can unset the variables and still reach the endpoint the API would use.
  const horizonBases = [HORIZON, CANONICAL_HORIZON];
  const rpcBases = [RPC, CANONICAL_RPC];
  const handlers: Record<string, Handler> = {
    [`GET ${API}/health`]: () => json({ status: "ok" }),
    "RPC getHealth": () => json({ result: { status: "healthy" } }),
    "RPC getNetwork": () => json({ result: { passphrase: TESTNET } }),
    "RPC getLedgerEntries": () => json({ result: { entries: [{ key: "k" }] } }),
    ...Object.fromEntries(
      horizonBases.flatMap((base) => [
        [`GET ${base}/`, () => json({ network_passphrase: TESTNET })],
        [`GET ${base}/accounts/${PLATFORM}`, () => account("9999.0000000")],
        [`GET ${base}/accounts/${SME}`, () => account("9999.0000000")],
        [`GET ${base}/accounts/${INVESTOR}`, () => account("9999.0000000")]
      ]) as Array<[string, Handler]>
    ),
    ...Object.fromEntries(
      JOURNEY_TABLES.map((table) => [`HEAD ${SUPABASE}/rest/v1/${table}?select=*&limit=0`, () => new Response(null, { status: 200 })])
    ),
    [`HEAD ${SUPABASE}/rest/v1/revenue_share_distribution?select=campaign_id,period&limit=0`]: () =>
      new Response(null, { status: 200 }),
    [`GET ${SUPABASE}/rest/v1/profile?select=user_id&role=eq.ADMIN&status=eq.active&limit=1`]: () =>
      json([{ user_id: "11111111-1111-4111-8111-111111111111" }]),
    ...overrides
  };
  const calls: { key: string; url: string; init?: RequestInit }[] = [];
  const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    let key = `${method} ${url}`;
    if (rpcBases.includes(url)) {
      const body = JSON.parse(String(init?.body)) as { method: string };
      key = `RPC ${body.method}`;
    }
    calls.push({ key, url, ...(init ? { init } : {}) });
    const handler = handlers[key];
    if (!handler) throw new Error(`unexpected request: ${key}`);
    return handler(url, init);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

function deps(fetchFn: typeof fetch, extra: { env?: Record<string, string | undefined> } = {}) {
  return {
    env: extra.env ?? env,
    fetch: fetchFn,
    options,
    derivePublicKey: (secret: string) => {
      if (secret !== SECRET) throw new Error("bad secret");
      return PLATFORM;
    },
    contractInstanceKey: (contractId: string) => `KEY:${contractId}`
  };
}

function statusOf(report: Awaited<ReturnType<typeof runPreflight>>, id: string): string {
  const check = report.checks.find((candidate) => candidate.id === id);
  if (!check) throw new Error(`no check ${id}`);
  return check.status;
}

describe("demo preflight: parseArgs", () => {
  it("parses repeated investors, thresholds, json and the env file", () => {
    const parsed = parseArgs([
      "--json",
      "--env-file",
      ".env.cloud",
      "--api",
      API,
      "--platform",
      PLATFORM,
      "--sme",
      SME,
      "--investor",
      INVESTOR,
      "--investor",
      "GOTHER",
      "--platform-min",
      "5",
      "--sme-min",
      "6",
      "--investor-min",
      "7"
    ]);
    expect(parsed).toMatchObject({
      json: true,
      envFile: ".env.cloud",
      api: API,
      platform: PLATFORM,
      sme: SME,
      investors: [INVESTOR, "GOTHER"],
      thresholdsXlm: { platform: 5, sme: 6, investor: 7 }
    });
  });

  it("falls back to documented threshold defaults and reports help and unknown flags", () => {
    expect(parseArgs([]).thresholdsXlm).toEqual(DEFAULT_THRESHOLDS_XLM);
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["--nope"]).errors).toEqual(["Unknown option: --nope"]);
    expect(parseArgs(["--sme-min", "abc"]).errors).toEqual(["--sme-min must be a positive number"]);
  });
});

describe("demo preflight: environment names", () => {
  it("passes when every required name is present", async () => {
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(deps(fetchFn));
    expect(statusOf(report, "env-api")).toBe("pass");
    expect(statusOf(report, "env-web")).toBe("pass");
  });

  it.each(REQUIRED_API_ENV)("fails and names %s when it is missing for the API", async (name) => {
    const { fetchFn } = fetchDouble();
    const { [name]: _removed, ...rest } = env as Record<string, string>;
    void _removed;
    const report = await runPreflight(deps(fetchFn, { env: rest }));
    const check = report.checks.find((candidate) => candidate.id === "env-api");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain(name);
  });

  it.each(REQUIRED_WEB_ENV)("fails and names %s when it is missing for the web", async (name) => {
    const { fetchFn } = fetchDouble({ [`GET ${API}/health`]: () => json({ status: "ok" }) });
    const rest: Record<string, string | undefined> = { ...env, [name]: "" };
    const report = await runPreflight({ ...deps(fetchFn, { env: rest }), options: { ...options, api: API } });
    const check = report.checks.find((candidate) => candidate.id === "env-web");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain(name);
  });

  it("does not require the optional Stellar endpoints: the journey-critical env alone is green", async () => {
    const { STELLAR_HORIZON_URL: _horizon, STELLAR_RPC_URL: _rpc, ...journeyCritical } = env;
    void _horizon;
    void _rpc;
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(deps(fetchFn, { env: journeyCritical }));
    expect(statusOf(report, "env-api")).toBe("pass");
  });

  it("keeps the optional Stellar endpoints out of the required-name list", () => {
    expect(REQUIRED_API_ENV).not.toContain("STELLAR_HORIZON_URL");
    expect(REQUIRED_API_ENV).not.toContain("STELLAR_RPC_URL");
  });

  it("exports the canonical Testnet endpoints mirrored from the API config", () => {
    expect(STELLAR_TESTNET_HORIZON_URL).toBe(CANONICAL_HORIZON);
    expect(STELLAR_TESTNET_RPC_URL).toBe(CANONICAL_RPC);
  });

  it("requires the factory id and the platform key as a pair", async () => {
    const { fetchFn } = fetchDouble();
    const { STELLAR_PLATFORM_SECRET_KEY: _secret, ...rest } = env;
    void _secret;
    const report = await runPreflight({ ...deps(fetchFn, { env: rest }), options: { ...options, platform: PLATFORM } });
    const check = report.checks.find((candidate) => candidate.id === "env-api");
    expect(check?.detail).toContain("STELLAR_PLATFORM_SECRET_KEY");
  });
});

describe("demo preflight: email configuration", () => {
  it("passes with email disabled, reporting the defaults mirrored from the API config", async () => {
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(deps(fetchFn));
    const check = report.checks.find((candidate) => candidate.id === "email");
    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("RESEND_API_KEY unset");
    expect(check?.detail).toContain("no-reply@vaqcrow.com");
    expect(check?.detail).toContain("http://localhost:3001");
  });

  it("passes and reports the configured sender and base when the key is present", async () => {
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(
      deps(fetchFn, {
        env: {
          ...env,
          RESEND_API_KEY: "resend-key-never-printed",
          EMAIL_FROM: "Vaqcrow <hola@vaqcrow.com>",
          APP_BASE_URL: "https://web.example.test"
        }
      })
    );
    const check = report.checks.find((candidate) => candidate.id === "email");
    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("enabled");
    expect(check?.detail).toContain("hola@vaqcrow.com");
    expect(check?.detail).toContain("https://web.example.test");
  });

  it.each([
    ["APP_BASE_URL", "/portfolio"],
    ["APP_BASE_URL", "web.example.test"],
    ["APP_BASE_URL", "ftp://web.example.test"],
    ["EMAIL_FROM", "not an address"]
  ])("fails when %s is invalid: %s", async (name, value) => {
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(deps(fetchFn, { env: { ...env, [name]: value } }));
    const check = report.checks.find((candidate) => candidate.id === "email");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain(name);
  });

  it("never prints the Resend key in the report", async () => {
    const key = "resend-key-never-printed";
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(deps(fetchFn, { env: { ...env, RESEND_API_KEY: key } }));
    expect(formatReport(report, { json: false })).not.toContain(key);
    expect(formatReport(report, { json: true })).not.toContain(key);
  });
});

describe("demo preflight: service reachability", () => {
  it("passes every service check on the happy path and exits 0", async () => {
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(deps(fetchFn));
    expect(report.checks.filter((check) => check.status !== "pass")).toEqual([]);
    expect(exitCodeFor(report)).toBe(0);
  });

  it("fails the API check on a non-200 and on a network error", async () => {
    const down = fetchDouble({ [`GET ${API}/health`]: () => json({}, 503) });
    expect(statusOf(await runPreflight(deps(down.fetchFn)), "api-health")).toBe("fail");

    const boom = fetchDouble({
      [`GET ${API}/health`]: () => {
        throw new Error("connect ECONNREFUSED");
      }
    });
    const report = await runPreflight(deps(boom.fetchFn));
    expect(statusOf(report, "api-health")).toBe("fail");
    expect(exitCodeFor(report)).toBe(1);
  });

  it("uses the --api flag over the env value", async () => {
    const { fetchFn, calls } = fetchDouble({ "GET https://other.example.test/health": () => json({ status: "ok" }) });
    await runPreflight({ ...deps(fetchFn), options: { ...options, api: "https://other.example.test" } });
    expect(calls.map((call) => call.key)).toContain("GET https://other.example.test/health");
  });

  it("fails Horizon when unreachable or when it is not Testnet", async () => {
    const unreachable = fetchDouble({ [`GET ${HORIZON}/`]: () => json({}, 500) });
    expect(statusOf(await runPreflight(deps(unreachable.fetchFn)), "horizon")).toBe("fail");

    const wrongNetwork = fetchDouble({
      [`GET ${HORIZON}/`]: () => json({ network_passphrase: "Public Global Stellar Network ; September 2015" })
    });
    expect(statusOf(await runPreflight(deps(wrongNetwork.fetchFn)), "horizon")).toBe("fail");
  });

  it("fails the RPC when it is unhealthy or reports a non-Testnet passphrase", async () => {
    const unhealthy = fetchDouble({ "RPC getHealth": () => json({ result: { status: "behind" } }) });
    expect(statusOf(await runPreflight(deps(unhealthy.fetchFn)), "rpc")).toBe("fail");

    const wrongNetwork = fetchDouble({ "RPC getNetwork": () => json({ result: { passphrase: "Standalone Network ; February 2017" } }) });
    expect(statusOf(await runPreflight(deps(wrongNetwork.fetchFn)), "rpc")).toBe("fail");
  });

  it("probes the canonical Testnet endpoints when the Stellar URL variables are unset", async () => {
    const { STELLAR_HORIZON_URL: _horizon, STELLAR_RPC_URL: _rpc, ...rest } = env;
    void _horizon;
    void _rpc;
    const { fetchFn, calls } = fetchDouble();
    const report = await runPreflight(deps(fetchFn, { env: rest }));
    expect(statusOf(report, "horizon")).toBe("pass");
    expect(statusOf(report, "rpc")).toBe("pass");
    expect(calls.some((call) => call.key === `GET ${CANONICAL_HORIZON}/`)).toBe(true);
    expect(calls.some((call) => call.key === `GET ${CANONICAL_HORIZON}/accounts/${PLATFORM}`)).toBe(true);
    const rpcUrls = calls.filter((call) => call.key.startsWith("RPC ")).map((call) => call.url);
    expect(rpcUrls.length).toBeGreaterThan(0);
    expect(rpcUrls.every((url) => url === CANONICAL_RPC)).toBe(true);
  });

  it("names the canonical Testnet default in the horizon and rpc details when unset", async () => {
    const { STELLAR_HORIZON_URL: _horizon, STELLAR_RPC_URL: _rpc, ...rest } = env;
    void _horizon;
    void _rpc;
    const { fetchFn } = fetchDouble();
    const report = await runPreflight(deps(fetchFn, { env: rest }));
    const horizon = report.checks.find((candidate) => candidate.id === "horizon");
    const rpc = report.checks.find((candidate) => candidate.id === "rpc");
    expect(horizon?.detail).toContain(CANONICAL_HORIZON);
    expect(horizon?.detail).toMatch(/unset/);
    expect(rpc?.detail).toContain(CANONICAL_RPC);
    expect(rpc?.detail).toMatch(/unset/);
  });

  it("checks the factory contract instance through getLedgerEntries and fails when absent", async () => {
    const present = fetchDouble();
    await runPreflight(deps(present.fetchFn));
    const rpcCall = present.calls.find((call) => call.key === "RPC getLedgerEntries");
    expect(JSON.parse(String(rpcCall?.init?.body)).params).toEqual({ keys: [`KEY:${FACTORY}`] });

    const absent = fetchDouble({ "RPC getLedgerEntries": () => json({ result: { entries: [] } }) });
    expect(statusOf(await runPreflight(deps(absent.fetchFn)), "factory")).toBe("fail");

    const nullEntries = fetchDouble({ "RPC getLedgerEntries": () => json({ result: { entries: null } }) });
    expect(statusOf(await runPreflight(deps(nullEntries.fetchFn)), "factory")).toBe("fail");
  });
});

describe("demo preflight: accounts", () => {
  it("derives the platform key from the secret and reports an abbreviated public key only", async () => {
    const { fetchFn, calls } = fetchDouble();
    const report = await runPreflight(deps(fetchFn));
    expect(calls.map((call) => call.key)).toContain(`GET ${HORIZON}/accounts/${PLATFORM}`);
    const platform = report.checks.find((check) => check.id === "account-platform");
    expect(platform?.status).toBe("pass");
    expect(platform?.detail).not.toContain(PLATFORM);
    expect(platform?.detail).toContain(`${PLATFORM.slice(0, 4)}…${PLATFORM.slice(-4)}`);
  });

  it("uses --platform when the secret is absent, and fails when neither yields an account", async () => {
    const { STELLAR_PLATFORM_SECRET_KEY: _secret, ...rest } = env;
    void _secret;
    const { fetchFn } = fetchDouble();
    const report = await runPreflight({ ...deps(fetchFn, { env: rest }), options: { ...options, platform: PLATFORM } });
    expect(statusOf(report, "account-platform")).toBe("pass");

    const none = await runPreflight(deps(fetchDouble().fetchFn, { env: rest }));
    expect(statusOf(none, "account-platform")).toBe("fail");
  });

  it("fails when the secret cannot be derived, without echoing it", async () => {
    const { fetchFn } = fetchDouble();
    const report = await runPreflight({
      ...deps(fetchFn),
      derivePublicKey: () => {
        throw new Error(`invalid secret ${SECRET}`);
      }
    });
    expect(statusOf(report, "account-platform")).toBe("fail");
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });

  it("fails an account that does not exist on Horizon", async () => {
    const { fetchFn } = fetchDouble({ [`GET ${HORIZON}/accounts/${SME}`]: () => json({ status: 404 }, 404) });
    const report = await runPreflight(deps(fetchFn));
    const check = report.checks.find((candidate) => candidate.id === "account-sme");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("not found");
  });

  it.each([
    ["platform", PLATFORM, DEFAULT_THRESHOLDS_XLM.platform],
    ["sme", SME, DEFAULT_THRESHOLDS_XLM.sme],
    ["investor", INVESTOR, DEFAULT_THRESHOLDS_XLM.investor]
  ])("fails the %s account just below its threshold and passes exactly at it", async (role, key, threshold) => {
    const below = fetchDouble({
      [`GET ${HORIZON}/accounts/${key}`]: () =>
        json({ balances: [{ asset_type: "native", balance: `${threshold - 1}.9999999` }] })
    });
    expect(statusOf(await runPreflight(deps(below.fetchFn)), `account-${role}`)).toBe("fail");

    const exact = fetchDouble({
      [`GET ${HORIZON}/accounts/${key}`]: () => json({ balances: [{ asset_type: "native", balance: threshold.toFixed(7) }] })
    });
    expect(statusOf(await runPreflight(deps(exact.fetchFn)), `account-${role}`)).toBe("pass");
  });

  it("honors threshold flags and fails an account with no native balance line", async () => {
    const { fetchFn } = fetchDouble({
      [`GET ${HORIZON}/accounts/${INVESTOR}`]: () => json({ balances: [{ asset_type: "native", balance: "30.0000000" }] })
    });
    const strict = await runPreflight({
      ...deps(fetchFn),
      options: { ...options, thresholdsXlm: { ...DEFAULT_THRESHOLDS_XLM, investor: 50 } }
    });
    expect(statusOf(strict, "account-investor")).toBe("fail");

    const noNative = fetchDouble({ [`GET ${HORIZON}/accounts/${SME}`]: () => json({ balances: [] }) });
    expect(statusOf(await runPreflight(deps(noNative.fetchFn)), "account-sme")).toBe("fail");
  });

  it("fails the role when no SME or investor account was given", async () => {
    const { fetchFn } = fetchDouble();
    const report = await runPreflight({ ...deps(fetchFn), options: parseArgs([]) });
    expect(statusOf(report, "account-sme")).toBe("fail");
    expect(statusOf(report, "account-investor")).toBe("fail");
  });

  it("reads the SME and investors from the documented env names when no flag is given", async () => {
    const { fetchFn, calls } = fetchDouble();
    const report = await runPreflight({
      ...deps(fetchFn, {
        env: { ...env, DEMO_SME_PUBLIC_KEY: SME, DEMO_INVESTOR_PUBLIC_KEYS: `${INVESTOR}` }
      }),
      options: parseArgs([])
    });
    expect(statusOf(report, "account-sme")).toBe("pass");
    expect(statusOf(report, "account-investor")).toBe("pass");
    expect(calls.map((call) => call.key)).toContain(`GET ${HORIZON}/accounts/${INVESTOR}`);
  });
});

describe("demo preflight: remote schema", () => {
  it.each(JOURNEY_TABLES)("fails and names %s when the table is missing", async (table) => {
    const { fetchFn } = fetchDouble({
      [`HEAD ${SUPABASE}/rest/v1/${table}?select=*&limit=0`]: () => new Response(null, { status: 404 })
    });
    const report = await runPreflight(deps(fetchFn));
    const check = report.checks.find((candidate) => candidate.id === "schema-tables");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain(table);
  });

  it("sends the service key to PostgREST with HEAD and never reports it", async () => {
    const { fetchFn, calls } = fetchDouble();
    const report = await runPreflight(deps(fetchFn));
    const head = calls.find((call) => call.key.startsWith("HEAD "));
    expect(head?.init?.headers).toMatchObject({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
    expect(JSON.stringify(report)).not.toContain(SERVICE_KEY);
  });

  it("fails when revenue_share_distribution lacks campaign_id or period", async () => {
    const { fetchFn } = fetchDouble({
      [`HEAD ${SUPABASE}/rest/v1/revenue_share_distribution?select=campaign_id,period&limit=0`]: () =>
        new Response(null, { status: 400 })
    });
    const report = await runPreflight(deps(fetchFn));
    expect(statusOf(report, "schema-distribution-columns")).toBe("fail");
    expect(exitCodeFor(report)).toBe(1);
  });

  it("skips the schema checks with a failing reason when Supabase env is missing, without calling it", async () => {
    const { SUPABASE_URL: _url, ...rest } = env;
    void _url;
    const { fetchFn, calls } = fetchDouble();
    const report = await runPreflight(deps(fetchFn, { env: rest }));
    expect(statusOf(report, "schema-tables")).toBe("fail");
    expect(calls.some((call) => call.key.includes("/rest/v1/"))).toBe(false);
  });
});

describe("demo preflight: identity", () => {
  it("includes the identity tables in the journey tables", () => {
    expect(JOURNEY_TABLES).toEqual(expect.arrayContaining(["profile", "audit_log"]));
  });

  it("passes when an active ADMIN profile exists, asking for one row with the service key", async () => {
    const { fetchFn, calls } = fetchDouble();
    const report = await runPreflight(deps(fetchFn));
    expect(statusOf(report, "admin-profile")).toBe("pass");
    const call = calls.find((candidate) => candidate.key.startsWith("GET ") && candidate.url.includes("/rest/v1/profile"));
    expect(call?.init?.headers).toMatchObject({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });
  });

  it("fails, pointing at the seed command, when no active ADMIN exists", async () => {
    const { fetchFn } = fetchDouble({
      [`GET ${SUPABASE}/rest/v1/profile?select=user_id&role=eq.ADMIN&status=eq.active&limit=1`]: () => json([])
    });
    const report = await runPreflight(deps(fetchFn));
    const check = report.checks.find((candidate) => candidate.id === "admin-profile");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("seed:superadmin");
    expect(exitCodeFor(report)).toBe(1);
  });

  it("fails when the profile query errors, and skips it with a reason when Supabase env is missing", async () => {
    const { fetchFn } = fetchDouble({
      [`GET ${SUPABASE}/rest/v1/profile?select=user_id&role=eq.ADMIN&status=eq.active&limit=1`]: () => json({}, 404)
    });
    expect(statusOf(await runPreflight(deps(fetchFn)), "admin-profile")).toBe("fail");

    const { SUPABASE_URL: _url, ...rest } = env;
    void _url;
    const second = fetchDouble();
    const report = await runPreflight(deps(second.fetchFn, { env: rest }));
    expect(statusOf(report, "admin-profile")).toBe("fail");
    expect(second.calls.some((call) => call.key.includes("/rest/v1/"))).toBe(false);
  });

  it("does not require the super-admin password, and redacts it if it is ever present", async () => {
    expect(REQUIRED_API_ENV).not.toContain("VAQCROW_SUPERADMIN_PASSWORD");
    expect(REQUIRED_API_ENV).not.toContain("VAQCROW_SUPERADMIN_EMAIL");
    const password = "superadmin-password-never-printed";
    const { fetchFn } = fetchDouble({ [`GET ${API}/health`]: () => json({ leak: password }, 500) });
    const report = await runPreflight(deps(fetchFn, { env: { ...env, VAQCROW_SUPERADMIN_PASSWORD: password } }));
    expect(statusOf(report, "env-api")).toBe("pass");
    expect(formatReport(report, { json: true })).not.toContain(password);
  });
});

describe("demo preflight: secrets, report and exit code", () => {
  it("never prints a secret value in the human or JSON report", async () => {
    const { fetchFn } = fetchDouble({ [`GET ${API}/health`]: () => json({}, 500) });
    const report = await runPreflight(deps(fetchFn));
    for (const output of [formatReport(report, { json: false }), formatReport(report, { json: true })]) {
      expect(output).not.toContain(SECRET);
      expect(output).not.toContain(SERVICE_KEY);
      expect(output).not.toContain(LLM_KEY);
    }
  });

  it("prints a check per line with pass and fail marks, and valid JSON on request", async () => {
    const { fetchFn } = fetchDouble({ [`GET ${API}/health`]: () => json({}, 500) });
    const report = await runPreflight(deps(fetchFn));
    const text = formatReport(report, { json: false });
    expect(text).toMatch(/✔ .*Horizon/);
    expect(text).toMatch(/✖ .*API/);
    const parsed = JSON.parse(formatReport(report, { json: true })) as { ok: boolean; checks: unknown[] };
    expect(parsed.ok).toBe(false);
    expect(parsed.checks.length).toBe(report.checks.length);
  });

  it("exits non-zero when any required check fails and zero when all pass", async () => {
    expect(exitCodeFor({ ok: true, checks: [] })).toBe(0);
    expect(exitCodeFor({ ok: false, checks: [] })).toBe(1);
    const { fetchFn } = fetchDouble({ "RPC getHealth": () => json({ result: { status: "behind" } }) });
    const report = await runPreflight(deps(fetchFn));
    expect(report.ok).toBe(false);
    expect(exitCodeFor(report)).toBe(1);
  });

  it("keeps running the other checks when one fails", async () => {
    const { fetchFn } = fetchDouble({ [`GET ${HORIZON}/`]: () => json({}, 500) });
    const report = await runPreflight(deps(fetchFn));
    expect(statusOf(report, "rpc")).toBe("pass");
    expect(statusOf(report, "schema-tables")).toBe("pass");
  });
});
