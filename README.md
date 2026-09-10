# Ceylon Events

Microservices ticketing platform for events hosted at partner restaurants,
where attendees pre-order food alongside their ticket and restaurants get a
consolidated per-table prep view before doors open.

## Status

Phase 0 (foundations), Phase 1 (restaurant onboarding & menu management),
Phase 2 (venue seating system), Phase 3 (event & ticketing core), and
Phase 4 (payments) are done. See the build spec for the full phase plan.

Implemented so far:

- **Identity Service** — signup/login, JWT access+refresh, RBAC roles,
  restaurant-staff invites.
- **Restaurant Service** — restaurant onboarding/approval, menu categories
  and items.
- **Media Service** — presigned upload URLs against MinIO/S3 (a separate
  browser-facing endpoint from the one used for internal calls, since a
  presigned PUT has to be signed against a host the browser can reach).
- **Venue/Seating Service** — seat-map authoring (sections/tables/seats),
  immutable published versions, Redis-backed seat hold-locks with TTL.
- **Event Service** — event CRUD, publish/cancel lifecycle, ticket tiers
  (pricing, sale windows, optional section restrictions, quantity limits).
- **Order/Ticketing Service** — checkout (pre-payment): validates the
  event/tier/seat-hold against Event and Venue services, snapshots price
  and seat label, creates a PENDING order.
- **Payment Service** — PayHere checkout (hash generation, IPN webhook
  with signature verification, idempotent processing) and a payment-proof
  upload/admin-approval queue with an audit trail. Either path, once
  confirmed, orchestrates order confirmation and marks any seated items
  sold in the Venue/Seating Service via a shared-secret internal-auth
  guard (`InternalAuthGuard` in `@ceylon/nest-common`) — the first
  service-to-service-only endpoints in this build.
- **Check-in Service** — lazily generates one QR-coded ticket per order
  item the first time a confirmed order's tickets are viewed (idempotent
  on a DB unique constraint), plus a door-staff lookup/check-in flow
  scoped to the ticket's own restaurant.
- **API Gateway** — reverse proxy (including correct
  `application/x-www-form-urlencoded` forwarding for PayHere's webhook),
  rate limiting, aggregated health.
- **web-admin** — restaurant approval queue, restaurant creation, seat-map
  builder (canvas-based, drag to position, publish versions), event
  creation/publishing and ticket-tier management, payment-proof
  verification queue.
- **web-restaurant** — menu management, staff invites, a door check-in
  scanner (manual/scanner-keyboard QR entry, lookup-then-confirm).
- **web-user** — restaurant discovery, menu preview, event discovery,
  seated/general-admission checkout flow (seat hold → review → place
  order), PayHere redirect checkout or payment-proof upload, order
  history/cancellation, and a QR ticket view once an order is confirmed.
- Full Docker Compose stack: Postgres (one database per service),
  Redis, RabbitMQ, MinIO, pgAdmin.

Real end-to-end PayHere IPN delivery needs a publicly reachable
`notify_url` (a tunnel like ngrok in front of the gateway, or PayHere's
own sandbox test tools) — not achievable from a purely local Docker Compose
setup. The webhook signature verification and order-confirmation logic
are still fully implemented and independently verified by POSTing a
correctly-signed form body directly (see `payhere.util.ts`'s hash
functions for how to compute one).

## Stack

NestJS microservices + Next.js portals in a pnpm/Turborepo monorepo. See
`libs/` for shared types (`@ceylon/shared-types`), NestJS building blocks
(`@ceylon/nest-common`), the canvas-based seat-map UI kit
(`@ceylon/seatmap-ui`, built on react-konva), and the general UI kit
(`@ceylon/design-system`).

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

## Dev tips

- On Windows hosts, webpack's file watcher (`nest start --watch`) does not
  always pick up changes made from the host into a bind-mounted container.
  If edits to a NestJS service don't seem to take effect, run
  `docker compose restart <service>`.
- `next build`'s `output: "standalone"` trace-copy step can fail locally on
  Windows with `EPERM: operation not permitted, symlink` (creating symlinks
  needs Developer Mode/elevation on Windows). This does not affect the
  Docker build, which runs inside a Linux container — only a bare
  `pnpm build` run directly on a Windows host hits it.

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
