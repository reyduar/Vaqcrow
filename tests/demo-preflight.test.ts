import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THRESHOLDS_XLM,
  REQUIRED_API_ENV,
  REQUIRED_WEB_ENV,
  JOURNEY_TABLES,
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
  NEXT_PUBLIC_API_BASE_URL: API
};

const options = parseArgs(["--sme", SME, "--investor", INVESTOR]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** A fetch double: routes by exact URL (+ JSON-RPC method), every unhandled call is a test failure. */
function fetchDouble(overrides: Record<string, Handler> = {}) {
  const account = (xlm: string) => json({ balances: [{ asset_type: "native", balance: xlm }] });
  const handlers: Record<string, Handler> = {
    [`GET ${API}/health`]: () => json({ status: "ok" }),
    [`GET ${HORIZON}/`]: () => json({ network_passphrase: TESTNET }),
    "RPC getHealth": () => json({ result: { status: "healthy" } }),
    "RPC getNetwork": () => json({ result: { passphrase: TESTNET } }),
    "RPC getLedgerEntries": () => json({ result: { entries: [{ key: "k" }] } }),
    [`GET ${HORIZON}/accounts/${PLATFORM}`]: () => account("9999.0000000"),
    [`GET ${HORIZON}/accounts/${SME}`]: () => account("9999.0000000"),
    [`GET ${HORIZON}/accounts/${INVESTOR}`]: () => account("9999.0000000"),
    ...Object.fromEntries(
      JOURNEY_TABLES.map((table) => [`HEAD ${SUPABASE}/rest/v1/${table}?select=*&limit=0`, () => new Response(null, { status: 200 })])
    ),
    [`HEAD ${SUPABASE}/rest/v1/revenue_share_distribution?select=campaign_id,period&limit=0`]: () =>
      new Response(null, { status: 200 }),
    ...overrides
  };
  const calls: { key: string; init?: RequestInit }[] = [];
  const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    let key = `${method} ${url}`;
    if (url === RPC) {
      const body = JSON.parse(String(init?.body)) as { method: string };
      key = `RPC ${body.method}`;
    }
    calls.push({ key, ...(init ? { init } : {}) });
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

  it("requires the factory id and the platform key as a pair", async () => {
    const { fetchFn } = fetchDouble();
    const { STELLAR_PLATFORM_SECRET_KEY: _secret, ...rest } = env;
    void _secret;
    const report = await runPreflight({ ...deps(fetchFn, { env: rest }), options: { ...options, platform: PLATFORM } });
    const check = report.checks.find((candidate) => candidate.id === "env-api");
    expect(check?.detail).toContain("STELLAR_PLATFORM_SECRET_KEY");
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
