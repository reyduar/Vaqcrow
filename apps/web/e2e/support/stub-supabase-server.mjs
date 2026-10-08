#!/usr/bin/env node
/**
 * Local double of the Supabase Auth (GoTrue) and PostgREST endpoints that
 * `apps/web` uses (issue #380). Browser E2E runs against it instead of a live
 * Supabase project, so pull-request verification never reaches Supabase.
 *
 * Covered, with the shapes `@supabase/supabase-js` 2.116.0 / `@supabase/ssr`
 * 0.12.7 read:
 * - `POST /auth/v1/signup`: in-memory user plus its `profile` row from
 *   `options.data { role, display_name }` (mirrors the `handle_new_user`
 *   trigger: only `PYME`/`INVERSOR`, name of at least 2 characters). Email
 *   confirmation is REQUIRED, so the answer is a user without a session.
 * - `POST /auth/v1/token?grant_type=password|refresh_token`: a session whose
 *   access token is an ES256 JWT with a `kid`. Sign-in fails with
 *   `invalid_credentials` or `email_not_confirmed` like Supabase Auth.
 * - `GET /auth/v1/.well-known/jwks.json`: the public key. `getClaims()` verifies
 *   asymmetric tokens locally with WebCrypto against this JWKS (in the browser
 *   and in the Next.js proxy), so no real signing key is involved.
 * - `GET /auth/v1/user` (the `getUser` fallback) and `POST /auth/v1/logout`.
 * - `GET /rest/v1/profile?user_id=eq.<id>`: only the caller's own row, decided
 *   by the verified bearer token (mirror of RLS `profile_select_own`).
 *
 * Test-only controls: `POST /__confirm { email }` confirms an account (the
 * email link a real project would send), `POST /__reset` forgets every user,
 * and `POST /__seed-admin { email, password, displayName }` creates a confirmed
 * `ADMIN` (#410 / U7) — the stand-in for the manual super-admin seed script,
 * since `ADMIN` is never self-assigned through signup.
 *
 * Unlike `stub-api-server.mjs`, this double reads the clock and generates a
 * key pair per start: the client rejects an expired JWT, so `exp` must follow
 * real time. Nothing it returns is asserted literally by the specs.
 */
import { createServer } from "node:http";
import { generateKeyPairSync, randomUUID, sign, verify } from "node:crypto";

const HOST = "127.0.0.1";
const PORT = Number(process.env["STUB_SUPABASE_PORT"] ?? 4312);
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const PROFILE_ROLES = new Set(["PYME", "INVERSOR"]);

const KID = "e2e-local-double";
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const PUBLIC_JWK = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "ES256", use: "sig", key_ops: ["verify"] };

/** email → { id, email, password, confirmed, userMetadata } */
const users = new Map();
/** user_id → { user_id, role, display_name } */
const profiles = new Map();
/** refresh token → user id */
const refreshTokens = new Map();

const base64url = (input) => Buffer.from(input).toString("base64url");
const nowSeconds = () => Math.floor(Date.now() / 1000);

function signJwt(payload) {
  const header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT", kid: KID }));
  const body = base64url(JSON.stringify(payload));
  const signature = sign("sha256", Buffer.from(`${header}.${body}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${body}.${signature.toString("base64url")}`;
}

/** The verified payload of a bearer token, or `null` when it is not a valid, unexpired JWT of this double. */
function verifyJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const valid = verify("sha256", Buffer.from(`${header}.${body}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
  if (!valid) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return typeof payload.exp === "number" && payload.exp > nowSeconds() ? payload : null;
}

function bearerOf(request) {
  const value = request.headers["authorization"] ?? "";
  return value.startsWith("Bearer ") ? value.slice("Bearer ".length) : "";
}

function userJson(user) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.confirmed ? "2026-10-03T12:00:00Z" : null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: user.userMetadata,
    identities: [{ id: user.id, user_id: user.id, provider: "email", identity_data: { sub: user.id } }],
    created_at: "2026-10-03T12:00:00Z",
    updated_at: "2026-10-03T12:00:00Z"
  };
}

function sessionJson(user) {
  const iat = nowSeconds();
  const refreshToken = randomUUID();
  refreshTokens.set(refreshToken, user.id);
  return {
    access_token: signJwt({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      session_id: randomUUID(),
      aal: "aal1",
      iat,
      exp: iat + ACCESS_TOKEN_TTL_SECONDS
    }),
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    expires_at: iat + ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    user: userJson(user)
  };
}

const userById = (id) => [...users.values()].find((user) => user.id === id);

function cors(request, response) {
  response.setHeader("Access-Control-Allow-Origin", request.headers["origin"] ?? "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  // `*` does not cover `Authorization` in browsers: echo the requested headers.
  response.setHeader("Access-Control-Allow-Headers", request.headers["access-control-request-headers"] ?? "*");
  response.setHeader("Access-Control-Expose-Headers", "x-supabase-api-version, content-range");
  response.setHeader("Vary", "Origin");
}

function send(response, status, body) {
  response.statusCode = status;
  if (body === undefined) return response.end();
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

/** Supabase Auth error body; the version header makes the client read `code`. */
function authError(response, status, code, message) {
  response.setHeader("x-supabase-api-version", "2024-01-01");
  send(response, status, { code, error_code: code, msg: message, message });
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  if (raw === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function handleSignup(body, response) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email.includes("@")) return authError(response, 400, "email_address_invalid", "Email address is invalid");
  if (password.length < 6) return authError(response, 422, "weak_password", "Password should be at least 6 characters");

  const existing = users.get(email);
  // With confirmation on, Supabase hides existing accounts: same answer, nothing created.
  if (existing) return send(response, 200, { ...userJson(existing), identities: [] });

  const data = typeof body.data === "object" && body.data !== null ? body.data : {};
  const role = data.role;
  const displayName = typeof data.display_name === "string" ? data.display_name.trim() : "";
  if (!PROFILE_ROLES.has(role) || displayName.length < 2) {
    // The signup trigger rejects the insert; Supabase Auth reports it as a 500.
    return authError(response, 500, "unexpected_failure", "Database error saving new user");
  }

  const user = { id: randomUUID(), email, password, confirmed: false, userMetadata: { role, display_name: displayName } };
  users.set(email, user);
  profiles.set(user.id, { user_id: user.id, role, display_name: displayName });
  return send(response, 200, userJson(user));
}

function handleToken(grantType, body, response) {
  if (grantType === "password") {
    const user = users.get(String(body.email ?? "").trim().toLowerCase());
    if (!user || user.password !== body.password) {
      return authError(response, 400, "invalid_credentials", "Invalid login credentials");
    }
    if (!user.confirmed) return authError(response, 400, "email_not_confirmed", "Email not confirmed");
    return send(response, 200, sessionJson(user));
  }
  if (grantType === "refresh_token") {
    const userId = refreshTokens.get(String(body.refresh_token ?? ""));
    const user = userId ? userById(userId) : undefined;
    if (!user) return authError(response, 400, "refresh_token_not_found", "Invalid Refresh Token");
    return send(response, 200, sessionJson(user));
  }
  return authError(response, 400, "validation_failed", "Unsupported grant type");
}

/** `GET /rest/v1/profile`: the caller's own row only (RLS `profile_select_own`). */
function handleProfile(url, request, response) {
  const token = bearerOf(request);
  const looksLikeJwt = token.split(".").length === 3;
  const claims = looksLikeJwt ? verifyJwt(token) : null;
  if (looksLikeJwt && !claims) return send(response, 401, { code: "PGRST301", message: "JWT invalid" });

  const filter = url.searchParams.get("user_id") ?? "";
  const requested = filter.startsWith("eq.") ? filter.slice(3) : null;
  const own = claims ? profiles.get(claims.sub) : undefined;
  const rows = own && (requested === null || requested === own.user_id) ? [own] : [];
  const columns = (url.searchParams.get("select") ?? "*").split(",").map((column) => column.trim());
  const projected = rows.map((row) =>
    columns.includes("*") ? row : Object.fromEntries(columns.filter((c) => c in row).map((c) => [c, row[c]]))
  );
  return send(response, 200, projected);
}

async function route(request, response) {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  const { pathname } = url;
  const method = request.method ?? "GET";

  if (method === "OPTIONS") return send(response, 204);
  if (method === "GET" && pathname === "/health") return send(response, 200, { status: "ok" });

  if (method === "POST" && pathname === "/__reset") {
    users.clear();
    profiles.clear();
    refreshTokens.clear();
    return send(response, 204);
  }
  if (method === "POST" && pathname === "/__confirm") {
    const user = users.get(String((await readJson(request)).email ?? "").trim().toLowerCase());
    if (!user) return send(response, 404, { error: "unknown_email" });
    user.confirmed = true;
    return send(response, 200, { confirmed: true });
  }

  if (method === "POST" && pathname === "/__seed-admin") {
    const body = await readJson(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim();
    if (!email.includes("@") || password.length < 6 || displayName.length < 2) {
      return send(response, 400, { error: "invalid_seed" });
    }
    const user = { id: randomUUID(), email, password, confirmed: true, userMetadata: { display_name: displayName } };
    users.set(email, user);
    profiles.set(user.id, { user_id: user.id, role: "ADMIN", display_name: displayName });
    return send(response, 201, { seeded: true });
  }

  if (method === "GET" && pathname === "/auth/v1/.well-known/jwks.json") return send(response, 200, { keys: [PUBLIC_JWK] });
  if (method === "POST" && pathname === "/auth/v1/signup") return handleSignup(await readJson(request), response);
  if (method === "POST" && pathname === "/auth/v1/token") {
    return handleToken(url.searchParams.get("grant_type"), await readJson(request), response);
  }
  if (method === "GET" && pathname === "/auth/v1/user") {
    const claims = verifyJwt(bearerOf(request));
    const user = claims ? userById(claims.sub) : undefined;
    if (!user) return authError(response, 401, "bad_jwt", "invalid JWT");
    return send(response, 200, userJson(user));
  }
  if (method === "POST" && pathname === "/auth/v1/logout") {
    const claims = verifyJwt(bearerOf(request));
    if (claims) {
      for (const [token, userId] of refreshTokens) if (userId === claims.sub) refreshTokens.delete(token);
    }
    return send(response, 204);
  }
  if (method === "GET" && pathname === "/rest/v1/profile") return handleProfile(url, request, response);

  return send(response, 404, { error: "not_found", path: pathname });
}

createServer((request, response) => {
  cors(request, response);
  route(request, response).catch(() => send(response, 500, { error: "stub_failure" }));
}).listen(PORT, HOST, () => {
  process.stdout.write(`stub-supabase listening on http://${HOST}:${PORT}\n`);
});
