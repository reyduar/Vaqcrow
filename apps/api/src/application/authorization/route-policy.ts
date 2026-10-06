import type { Role } from "../ports/auth-port.js";

export type RoutePolicy =
  | { readonly kind: "public" }
  | { readonly kind: "authenticated" }
  | { readonly kind: "roles"; readonly roles: readonly Role[] };

export type RoutePolicyLookup = (method: string, pattern: string) => RoutePolicy | undefined;

const PUBLIC: RoutePolicy = { kind: "public" };
const AUTHENTICATED: RoutePolicy = { kind: "authenticated" };
const only = (...roles: Role[]): RoutePolicy => ({ kind: "roles", roles });

/**
 * The authorization table: `METHOD + Fastify route pattern` -> policy.
 *
 * A route that is not listed here is denied (403) by the HTTP hook, so adding a
 * route without deciding who may call it can never open it by accident.
 */
const ROUTE_POLICIES: Readonly<Record<string, RoutePolicy>> = {
  "GET /health": PUBLIC,

  "POST /sme-requests": only("PYME"),
  "GET /sme-requests/:applicationId": only("PYME"),

  "POST /businesses": only("PYME"),
  "GET /businesses/mine": only("PYME"),

  // Application completeness check (#402/T1a): the PyME checks the metadata its
  // own wizard declares before sending the application to human review.
  "POST /completeness-check": only("PYME"),

  // Freighter wallet connection (#407/T1b): issue and consume a single-use
  // challenge, then read the stored key and its frozen state.
  "POST /profile/wallet/challenge": only("PYME"),
  "POST /profile/wallet": only("PYME"),
  "GET /profile/wallet": only("PYME"),

  "POST /storage/uploads": only("PYME"),
  "DELETE /storage/uploads": only("PYME"),
  "GET /storage/uploads": only("ADMIN"),

  "GET /businesses/:businessId/sales-periods": only("PYME", "ADMIN"),
  "POST /businesses/:businessId/sales-periods": only("PYME"),

  "POST /assessments": only("ADMIN"),
  "POST /application-reviews/:applicationId/assessments": only("ADMIN"),
  "GET /application-reviews/:applicationId/assessment": only("ADMIN"),
  "GET /application-reviews/:applicationId/context": only("ADMIN"),
  "GET /application-reviews/:applicationId/manual-review": only("ADMIN"),
  "POST /application-reviews/:applicationId/decisions": only("ADMIN"),
  "GET /application-reviews/:applicationId/decisions": only("ADMIN"),

  "POST /campaigns": only("ADMIN"),
  "POST /admin/rates": only("ADMIN"),
  "GET /admin/rates/current": only("ADMIN"),
  "GET /campaigns/:campaignId": AUTHENTICATED,
  "GET /campaigns/:campaignId/transactions/:hash": AUTHENTICATED,
  "POST /campaigns/:campaignId/invocations": AUTHENTICATED,
  "POST /campaigns/:campaignId/invocations/submission": AUTHENTICATED,

  "POST /revenue-share-distributions": only("PYME"),
  "POST /revenue-share-distributions/:distributionId/submission": only("PYME"),
  "GET /revenue-share-distributions/:distributionId": only("PYME", "ADMIN"),

  // In-app notifications (#382/T1c): every signed-in role reads and marks only
  // its own rows. The recipient is the verified principal, never the request.
  "GET /notifications": AUTHENTICATED,
  "GET /notifications/unread-count": AUTHENTICATED,
  "POST /notifications/:notificationId/read": AUTHENTICATED,
  "POST /notifications/read-all": AUTHENTICATED,

  // Legacy surface, not wired in index.ts today.
  "POST /funding-intents": only("ADMIN"),
  "POST /funding-intents/:intentId/submission": only("ADMIN"),
  "GET /funding-intents/:intentId": only("ADMIN")
};

export const ROUTE_POLICY_KEYS: readonly string[] = Object.keys(ROUTE_POLICIES);

/** HEAD routes are the implicit twins of GET routes and share their policy. */
export const resolveRoutePolicy: RoutePolicyLookup = (method, pattern) => {
  const effective = method === "HEAD" ? "GET" : method;
  return Object.hasOwn(ROUTE_POLICIES, `${effective} ${pattern}`)
    ? ROUTE_POLICIES[`${effective} ${pattern}`]
    : undefined;
};
