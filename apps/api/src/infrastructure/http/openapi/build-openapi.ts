import { z } from "zod";
import { ROUTE_POLICY_KEYS, resolveRoutePolicy } from "../../../application/authorization/route-policy.js";
import { ROUTE_OPERATIONS, type OperationSpec } from "./route-registry.js";

/**
 * Builds the OpenAPI 3.1 document for the API from two machine-checked sources:
 *
 * - the **route inventory** (`ROUTE_POLICY_KEYS` / `resolveRoutePolicy`), so a
 *   route that exists in the authorization table can never be missing from the
 *   spec, and its security is derived from the same policy the HTTP hook
 *   enforces — never hand-copied; and
 * - the **per-route operation metadata** (`ROUTE_OPERATIONS`), which maps each
 *   key to its tag, summary, request body and responses using the shared Zod
 *   contracts (`@vaqcrow/contracts`). Schemas are produced with Zod v4's own
 *   `z.toJSONSchema`, so a contract change flows into the spec and the drift
 *   test fails instead of the document going stale by hand.
 *
 * The document is a build-time artifact: it reads no secret, touches no live
 * service, and is deterministic.
 */

const ERROR_SCHEMA_REF = "#/components/schemas/ErrorResponse";

/** Methods whose operation may carry a request body. */
const METHODS_WITH_BODY: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH"]);

export interface OpenApiDocument {
  readonly openapi: "3.1.0";
  readonly info: {
    readonly title: string;
    readonly version: string;
    readonly description: string;
  };
  readonly servers: readonly { readonly url: string; readonly description: string }[];
  readonly tags: readonly { readonly name: string; readonly description: string }[];
  readonly paths: Record<string, Record<string, unknown>>;
  readonly components: {
    readonly securitySchemes: Record<string, unknown>;
    readonly schemas: Record<string, unknown>;
  };
}

/** Zod schema -> a $schema-free JSON Schema suitable for OpenAPI 3.1. */
function toJsonSchema(schema: z.ZodType, io: "input" | "output"): Record<string, unknown> {
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    reused: "inline",
    unrepresentable: "any"
  }) as Record<string, unknown>;
  delete json["$schema"];
  return json;
}

/** Fastify `:param` pattern -> OpenAPI `{param}` path plus its parameter names. */
export function toOpenApiPath(fastifyPattern: string): { readonly path: string; readonly params: readonly string[] } {
  const params: string[] = [];
  const path = fastifyPattern.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    params.push(name);
    return `{${name}}`;
  });
  return { path, params };
}

function securityFor(method: string, pattern: string): { readonly security: unknown[]; readonly roles?: readonly string[] } {
  const policy = resolveRoutePolicy(method, pattern);
  if (policy === undefined || policy.kind === "public") return { security: [] };
  if (policy.kind === "authenticated") return { security: [{ bearerAuth: [] }] };
  return { security: [{ bearerAuth: [] }], roles: policy.roles };
}

function errorResponses(statuses: readonly number[] | undefined): Record<string, unknown> {
  const responses: Record<string, unknown> = {};
  for (const status of statuses ?? []) {
    responses[String(status)] = {
      description: "Sanitized error envelope.",
      content: { "application/json": { schema: { $ref: ERROR_SCHEMA_REF } } }
    };
  }
  return responses;
}

function successResponses(spec: OperationSpec): Record<string, unknown> {
  const responses: Record<string, unknown> = {};
  for (const [status, response] of Object.entries(spec.success)) {
    if (spec.bytes !== undefined) {
      responses[status] = {
        description: response.description,
        content: { [spec.bytes]: { schema: { type: "string", format: "binary" } } }
      };
      continue;
    }
    responses[status] = {
      description: response.description,
      ...(response.schema === undefined
        ? {}
        : { content: { "application/json": { schema: toJsonSchema(response.schema, "output") } } })
    };
  }
  return responses;
}

function operationFor(method: string, pattern: string, spec: OperationSpec): Record<string, unknown> {
  const { params } = toOpenApiPath(pattern);
  const { security, roles } = securityFor(method, pattern);
  const roleNote = roles === undefined ? undefined : `Requires role: ${roles.join(" or ")}.`;

  return {
    tags: [spec.tag],
    summary: spec.summary,
    ...(spec.description === undefined && roleNote === undefined
      ? {}
      : { description: [spec.description, roleNote].filter(Boolean).join(" ") }),
    operationId: `${method.toLowerCase()}${toOpenApiPath(pattern).path.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string) => (c ? c.toUpperCase() : ""))}`,
    security,
    ...(roles === undefined ? {} : { "x-required-roles": roles }),
    ...(params.length === 0
      ? {}
      : {
          parameters: params.map((name) => ({
            name,
            in: "path",
            required: true,
            schema: { type: "string" }
          }))
        }),
    ...(spec.request === undefined || !METHODS_WITH_BODY.has(method)
      ? {}
      : {
          requestBody: {
            required: true,
            content: {
              [spec.request.contentType]:
                spec.request.schema === undefined
                  ? { schema: { type: "object", description: spec.request.description ?? "Body validated inline." } }
                  : { schema: toJsonSchema(spec.request.schema, "input") }
            }
          }
        }),
    responses: { ...successResponses(spec), ...errorResponses(spec.errors) }
  };
}

export function buildOpenApi(): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const key of ROUTE_POLICY_KEYS) {
    const spaceAt = key.indexOf(" ");
    const method = key.slice(0, spaceAt);
    const pattern = key.slice(spaceAt + 1);
    const spec = ROUTE_OPERATIONS[key];
    if (spec === undefined) {
      // The drift test guarantees this never happens; throwing here keeps the
      // generator honest if it is ever called without the registry in sync.
      throw new Error(`route-registry.ts is missing an entry for "${key}"`);
    }
    const { path } = toOpenApiPath(pattern);
    const pathItem = paths[path] ?? {};
    pathItem[method.toLowerCase()] = operationFor(method, pattern, spec);
    paths[path] = pathItem;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Vaqcrow API",
      version: "0.1.0",
      description:
        "HTTP surface of the Vaqcrow demo API (TFM). Non-production: the KYC/KYB, the sales history and the ARS/asset conversion are simulated; Stellar runs on Testnet with no economic value. All failures are sanitized `{ code }` / `{ error }` envelopes. Auth is a Supabase Bearer JWT with roles PYME / INVERSOR / ADMIN."
    },
    servers: [
      { url: "https://api-production-c07f.up.railway.app", description: "Demo deployment (Railway)" },
      { url: "http://localhost:3000", description: "Local development" }
    ],
    tags: TAG_LIST,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase Auth access token. The API resolves the principal (role + user id) from it; a caller-supplied identity is never trusted."
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          description:
            "Sanitized failure envelope. Always a stable `code` (and, for validation, an `errors` list); the provider's message/details/hint never cross this boundary.",
          properties: {
            code: { type: "string", description: "A stable machine code, e.g. `not_found`, `unavailable`." },
            error: { type: "string", description: "A stable code used by a few routes (e.g. notifications, favorites)." },
            errors: {
              type: "array",
              description: "Field-level validation findings (400 on the routes that validate a body).",
              items: {
                type: "object",
                properties: { field: { type: "string" }, code: { type: "string" } },
                required: ["field", "code"]
              }
            }
          },
          additionalProperties: true
        }
      }
    }
  };
}

const TAG_LIST = [
  { name: "Health", description: "Liveness and dependency status." },
  { name: "Marketplace", description: "Public listing and campaign detail." },
  { name: "Blog", description: "Public Markdown blog backed by docs/guides." },
  { name: "Assistant", description: "Help assistant grounded in the compiled wiki." },
  { name: "PyME", description: "The PyME onboarding, company, sales and campaign surface." },
  { name: "Wallet", description: "Freighter connection (challenge, connect, read)." },
  { name: "Storage", description: "Private document/photo uploads." },
  { name: "Investor", description: "Investor KYC, portfolio and reports." },
  { name: "Favorites", description: "Per-account saved campaigns." },
  { name: "Notifications", description: "In-app notification bell." },
  { name: "Assessments", description: "AI evaluation and the human review pipeline (admin)." },
  { name: "Campaigns", description: "Campaign snapshots and Stellar invocations." },
  { name: "Distributions", description: "Revenue-share distributions." },
  { name: "Admin", description: "Admin console: users, roles, invitations, audit log, rates." },
  { name: "Telemetry", description: "Wallet-failure beacon." },
  { name: "Legacy", description: "Present in the authorization table; not wired in the running composition." }
] as const;
