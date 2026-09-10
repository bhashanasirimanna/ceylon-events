# Ceylon Events

Microservices ticketing platform for events hosted at partner restaurants,
where attendees pre-order food alongside their ticket and restaurants get a
consolidated per-table prep view before doors open.

## Status

Phase 0 (foundations) + start of Phase 1 (restaurant onboarding & menu
management). See the build spec for the full phase plan.

Implemented so far:

- **Identity Service** — signup/login, JWT access+refresh, RBAC roles,
  restaurant-staff invites.
- **Restaurant Service** — restaurant onboarding/approval, menu categories
  and items.
- **Media Service** — presigned upload URLs against MinIO/S3.
- **API Gateway** — reverse proxy, rate limiting, aggregated health.
- **web-admin** — restaurant approval queue, restaurant creation.
- **web-restaurant** — menu management, staff invites.
- **web-user** — restaurant discovery + menu preview.
- Full Docker Compose stack: Postgres (one database per service),
  Redis, RabbitMQ, MinIO, pgAdmin.

## Stack

NestJS microservices + Next.js portals in a pnpm/Turborepo monorepo. See
`libs/` for shared types (`@ceylon/shared-types`), NestJS building blocks
(`@ceylon/nest-common`), and the UI kit (`@ceylon/design-system`).

## Running everything

Docker is the only prerequisite — no local Node/Postgres/Redis needed.

```sh
cp .env.example .env
docker compose up -d --build
```

| Portal / service | URL |
|---|---|
| API Gateway | http://localhost:3000 |
| web-admin | http://localhost:4000 |
| web-user | http://localhost:4001 |
| web-restaurant | http://localhost:4002 |
| pgAdmin | http://localhost:5050 |
| MinIO console | http://localhost:9001 |
| RabbitMQ management | http://localhost:15672 |

pgAdmin is pre-wired to the shared Postgres instance (see
`infra/pgadmin/servers.json`); log in with the credentials from `.env`
(`PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`), then use the
`ceylon` Postgres user password when prompted the first time.

`docker-compose.override.yml` is picked up automatically by `docker compose up`
and bind-mounts source into each container so edits hot-reload without a
rebuild. Remove it (or use `-f docker-compose.yml` explicitly) to run the
production-style build.

## Local development without Docker (optional)

```sh
pnpm install
pnpm dev        # turbo runs `dev` in every service/app in parallel
```

You'll need your own local Postgres/Redis/MinIO/RabbitMQ in that case —
Docker Compose remains the source of truth for how these are wired together.

## Monorepo layout

```
services/        NestJS microservices (one per bounded context)
apps/             Next.js portals: web-admin, web-user, web-restaurant
libs/             Shared TypeScript: shared-types, nest-common, design-system
infra/            Postgres init scripts, pgAdmin server config
```

## Database-per-service, one Postgres container

For local/staging Compose, every service gets its own database inside a
single shared Postgres instance (see `infra/postgres/init/`) rather than a
container per service — cheaper locally while still enforcing that each
service only ever connects to its own database. Production deploys can
split these onto separate managed Postgres instances without any code
changes (each service only knows its own `DATABASE_URL`).
