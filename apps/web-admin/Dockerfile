FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile=false

FROM base AS dev
EXPOSE 3000
CMD ["pnpm", "--filter", "@ceylon/web-admin", "dev"]

FROM base AS build
RUN pnpm --filter @ceylon/web-admin... build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/apps/web-admin/.next/standalone ./
COPY --from=build /workspace/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=build /workspace/apps/web-admin/public ./apps/web-admin/public
EXPOSE 3000
CMD ["node", "apps/web-admin/server.js"]
