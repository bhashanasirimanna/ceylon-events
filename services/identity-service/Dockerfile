# Build context is the repo root (see docker-compose.yml) so this stage can
# install the full pnpm workspace and resolve @ceylon/* workspace deps.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile=false

# dev: used directly by docker-compose.override.yml, source is bind-mounted
# in and `nest start --watch` runs on top of the deps installed here. Builds
# the shared libs' dist/ first since bind-mounting libs/ from the host can
# shadow the dist this image just produced during `pnpm install`.
FROM base AS dev
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @ceylon/shared-types build && pnpm --filter @ceylon/nest-common build && pnpm --filter @ceylon/identity-service dev"]

FROM base AS build
RUN pnpm --filter @ceylon/identity-service... build
RUN pnpm --filter @ceylon/identity-service deploy --prod /out/service

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/service .
EXPOSE 3000
CMD ["node", "dist/main.js"]
