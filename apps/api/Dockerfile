# syntax=docker/dockerfile:1
###############################################################################
# Wudly API — multi-stage build for Railway
# Monorepo-aware (pnpm workspaces). Builds @wudly/shared + the NestJS app,
# generates the Prisma client, and ships a lean production image.
###############################################################################

# ----- Base: pnpm via corepack -----
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# OpenSSL is required by Prisma's query engine at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ----- Build: install full workspace, compile shared + api, generate client -----
FROM base AS build
# Copy the whole monorepo and do a full install. Simpler and more reliable than
# juggling per-package node_modules across stages (pnpm uses symlinks).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @wudly/shared build
RUN pnpm --filter @wudly/api exec prisma generate
RUN pnpm --filter @wudly/api build

# Produce a self-contained production bundle for the API. Force a flat (hoisted)
# node_modules so it copies cleanly into the runtime image without symlinks.
RUN pnpm --filter @wudly/api --prod --config.node-linker=hoisted deploy /app/deploy

# Regenerate the Prisma client INSIDE the deploy bundle so the engine + generated
# client resolve against the deploy node_modules at runtime. `prisma` is a prod
# dependency (also needed for `migrate deploy` at runtime), so its binary is here.
RUN cd /app/deploy \
  && node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# ----- Runtime -----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/deploy/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma

# Entry script applies migrations then starts the server.
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Railway provides PORT; the app reads process.env.PORT.
EXPOSE 4000
CMD ["/usr/local/bin/docker-entrypoint.sh"]
