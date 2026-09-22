/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "packages-never-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" }
    },
    {
      name: "web-never-imports-domain",
      comment: "apps/web consumes contracts only; domain is backend-authoritative",
      severity: "error",
      from: { path: "^apps/web/" },
      to: { path: "(^packages/domain/|/@vaqcrow/domain/)" }
    },
    {
      name: "web-never-imports-ai",
      comment:
        "apps/web renders and never talks to the model: the AI assessment contract and its guardrails are backend-only and reach the UI through apps/api. No type-only exemption — the package carries runtime validation logic, not just types.",
      severity: "error",
      from: { path: "^apps/web/" },
      to: { path: "(^packages/ai/|/@vaqcrow/ai/)" }
    },
    {
      name: "no-cross-app-imports",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" }
    },
    {
      name: "domain-stays-framework-free",
      comment: "production source only — the package's own tooling config (vitest.config.ts) and tests may use vitest as a devDependency without making domain framework-bound",
      severity: "error",
      from: { path: "^packages/domain/src/", pathNot: "\\.test\\.ts$" },
      to: { dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"] }
    },
    {
      name: "contracts-never-import-node-core",
      comment: "contracts runtime exports must remain portable across Node and web consumers",
      severity: "error",
      from: { path: "^packages/contracts/src/", pathNot: "\\.test\\.ts$" },
      to: { dependencyTypes: ["core"] }
    },
    {
      name: "contracts-never-import-frameworks",
      comment: "framework integration belongs outside the portable contracts package",
      severity: "error",
      from: { path: "^packages/contracts/src/", pathNot: "\\.test\\.ts$" },
      to: { path: "(^|/)node_modules/(fastify|@fastify)(/|$)" }
    },
    {
      name: "api-application-stays-provider-free",
      comment:
        "apps/api/src/application holds use cases and ports; Fastify and provider SDKs belong in infrastructure/. type-only imports stay legal so ports can name SDK types.",
      severity: "error",
      from: { path: "^apps/api/src/application/" },
      to: {
        path: "(^|/)node_modules/(fastify|@fastify|@supabase|@stellar|stellar-sdk|@anthropic-ai|openai)(/|$)",
        dependencyTypesNot: ["type-only"]
      }
    },
    {
      name: "web-presentation-stays-contracts-free",
      comment:
        "apps/web/src/presentation renders; contracts cross the boundary in infrastructure/ and state/. type-only imports stay legal so components can name contract types.",
      severity: "error",
      from: { path: "^apps/web/src/presentation/" },
      to: { path: "(^packages/contracts/|/@vaqcrow/contracts/)", dependencyTypesNot: ["type-only"] }
    },
    {
      name: "web-application-stays-react-free",
      comment:
        "apps/web/src/application holds pure frozen data and selectors (trust copy, fixtures, navigation); React belongs in presentation/ and state/, not here.",
      severity: "error",
      from: { path: "^apps/web/src/application/" },
      to: { path: "(^|/)node_modules/(react|react-dom)(/|$)", dependencyTypesNot: ["type-only"] }
    },
    {
      name: "web-never-imports-server-stellar-sdk",
      comment:
        "apps/web signs through Freighter and never builds, decodes or verifies XDR — that belongs to apps/api. The SDK must not reach the browser bundle. type-only imports stay legal so a component could name an SDK type without shipping it.",
      severity: "error",
      from: { path: "^apps/web/src/" },
      to: {
        path: "(^|/)node_modules/@stellar/stellar-sdk(/|$)",
        dependencyTypesNot: ["type-only"]
      }
    },
    {
      name: "api-never-imports-wallet-sdk",
      comment:
        "apps/api holds no wallet and never signs; Freighter is the browser's signing surface, so the wallet SDK must not appear in the backend. type-only imports stay legal so a port could name a wallet type without depending on the wallet.",
      severity: "error",
      from: { path: "^apps/api/src/" },
      to: {
        path: "(^|/)node_modules/@stellar/freighter-api(/|$)",
        dependencyTypesNot: ["type-only"]
      }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    exclude: { path: "(^|/)(coverage|[.]turbo)/" }
  }
};
