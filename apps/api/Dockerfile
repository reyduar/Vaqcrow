# syntax=docker/dockerfile:1

# apps/api/Dockerfile
#
# BUILD CONTEXT IS THE MONOREPO ROOT, NOT apps/api.
# Every COPY path below is root-relative (packages/contracts/..., apps/api/...)
# and pnpm resolves the workspace from the root pnpm-workspace.yaml. Railway
# therefore keeps its root directory at the repository root and points here
# through railway.json -> build.dockerfilePath.
#
# The base is node:24-* deliberately: package.json pins
# engines.node ">=24.0.0 <25.0.0" and .npmrc sets engine-strict=true, so an
# install on any other major version aborts with ERR_PNPM_UNSUPPORTED_ENGINE.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.27.0 --activate
WORKDIR /app

# --- dependencies -------------------------------------------------------------
FROM base AS deps
# .npmrc carries engine-strict=true and manage-package-manager-versions=true.
# Without it the install stops enforcing the Node pin, which is how an image can
# end up built on a runtime the CI gates reject.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/
# apps/web/package.json is copied to keep the workspace declared by
# pnpm-workspace.yaml intact, so this install matches the one CI runs. pnpm
# tolerates a missing member, so it is hygiene rather than a hard requirement.
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# --- build --------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
# The root manifests are required in this stage too, and not only in deps: pnpm
# resolves the workspace from pnpm-workspace.yaml and resolves --filter targets
# against the root package.json. Without them the first build command fails with
# ERR_PNPM_NO_PKG_MANIFEST.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/ ./packages/contracts/
COPY packages/domain/ ./packages/domain/
COPY apps/api/ ./apps/api/
# The order is load-bearing: @vaqcrow/contracts and @vaqcrow/domain are consumed
# from their dist/, and apps/api/tsconfig.build.json declares no TypeScript
# project references, so tsc cannot resolve them until their dist/ exists.
RUN pnpm --filter @vaqcrow/contracts build
RUN pnpm --filter @vaqcrow/domain build
RUN pnpm --filter @vaqcrow/api build

# --- production ---------------------------------------------------------------
FROM node:24-alpine AS production
RUN corepack enable && corepack prepare pnpm@11.27.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/
COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/domain/package.json ./packages/domain/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/

# The deps stage installed with devDependencies, because the TypeScript build
# needs them. Production dependencies are therefore reinstalled from scratch
# here instead of copying the deps node_modules wholesale.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
