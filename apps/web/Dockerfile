# syntax=docker/dockerfile:1
###############################################################################
# Wudly Web — multi-stage build for Railway
# Builds @wudly/shared + the Next.js app (standalone output) into a lean image.
###############################################################################

# ----- Base: pnpm via corepack -----
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ----- Build -----
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# Enable Next standalone output (see apps/web/next.config.mjs).
ENV BUILD_STANDALONE=true
# Public API URL must be present at build time (baked into the client bundle).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Copy the whole monorepo and do a full install (reliable with pnpm symlinks).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

RUN pnpm --filter @wudly/shared build
RUN pnpm --filter @wudly/web build

# ----- Runtime (standalone) -----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Next standalone bundles a minimal server + only the needed node_modules.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

# Railway provides PORT; Next's standalone server honors PORT/HOSTNAME.
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
