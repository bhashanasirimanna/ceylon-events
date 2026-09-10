FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile=false

FROM base AS dev
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @ceylon/shared-types build && pnpm --filter @ceylon/nest-common build && pnpm --filter @ceylon/reporting-service dev"]

FROM base AS build
RUN pnpm --filter @ceylon/reporting-service... build
RUN pnpm --filter @ceylon/reporting-service deploy --prod /out/service

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/service .
EXPOSE 3000
CMD ["node", "dist/main.js"]
