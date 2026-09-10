# Ceylon Events

Microservices ticketing platform for events hosted at partner restaurants,
where attendees pre-order food alongside their ticket and restaurants get a
consolidated per-table prep view before doors open.

## Status

Phase 0 (foundations), Phase 1 (restaurant onboarding & menu management),
Phase 2 (venue seating system), Phase 3 (event & ticketing core),
Phase 4 (payments), Phase 5 (food pre-order — the platform's core
differentiator), Phase 6 (offers & promo codes), Phase 7 (ratings,
notifications & reporting), and Phase 8 (hardening & deployment prep)
are done. See the build spec for the full phase plan.

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
- **Food Order Service** — a food pre-order (one per ticket, with its own
  line items) tied to a confirmed/pending order, editable up to a
  configurable per-event cutoff, validated against the restaurant's own
  menu and enriched with a denormalized table number looked up from the
  event's seat-map snapshot. A kitchen status workflow (Received →
  Preparing → Ready → Served, single or bulk), a pre-event aggregate
  quantity-per-menu-item report (the platform's headline "prep with real
  numbers" feature), and a Server-Sent Events stream so the restaurant
  dashboard updates live. Never touches payment — food is always settled
  at the venue.
- **Offers Service** — ticket-linked perks ("VIP includes unlimited beer
  at 30% off"), bundled with one or more ticket tiers. UNLIMITED offers
  never block redemption (just an audit trail); CAPPED/SINGLE_USE track
  a per-ticket redemption count and reject once exhausted. Staff redeem
  by the same QR token already printed on the ticket, resolved via the
  Check-in Service's existing restaurant-ownership-checked lookup rather
  than a second auth mechanism.
- **Promo codes** — a checkout-time discount code (percentage or fixed,
  order-wide or scoped to one ticket tier, optional usage cap and
  expiry), added to the Order/Ticketing Service alongside the checkout
  logic it discounts. Orders now carry a subtotal/discount/total
  breakdown instead of a single flat total.
- **Ratings Service** — one rating per buyer per order per subject (an
  event, or a menu item the buyer actually pre-ordered on that order),
  gated on the order being their own, CONFIRMED, and the event having
  already started. Powers per-event/per-restaurant/per-menu-item rating
  summaries shown across all three portals.
- **Notification Service** — an in-app notification inbox per user
  (order confirmed/cancelled, payment failed, food ready), created via
  fire-and-forget internal calls from Order, Payment, and Food Order
  services — a notification-service outage never blocks the order,
  payment, or kitchen-status flow that triggered it. Live updates via
  Server-Sent Events, same query-token pattern as the food-order
  dashboard's stream.
- **Reporting Service** — a stateless read-only aggregator with no
  database of its own: composes already-authorized reads from Event,
  Order, Food Order, and Ratings services (forwarding the caller's own
  bearer token) into per-event, per-restaurant, and platform-wide
  reports — tickets sold, revenue, ticket-tier breakdown, food-item
  prep summary, and rating summary.
- **API Gateway** — reverse proxy (including correct
  `application/x-www-form-urlencoded` forwarding for PayHere's webhook,
  and a streaming pass-through mode for SSE endpoints so a live
  connection isn't buffered before reaching the client), rate limiting,
  aggregated health.
- **web-admin** — restaurant approval queue, restaurant creation, seat-map
  builder (canvas-based, drag to position, publish versions), event
  creation/publishing and ticket-tier management, payment-proof
  verification queue, offer and promo-code management with redemption
  stats, a live notification bell, a platform-wide reports dashboard,
  and per-restaurant/per-event report + ratings-moderation sections.
- **web-restaurant** — menu management, staff invites, a door check-in
  scanner (manual/scanner-keyboard QR entry, lookup-then-confirm), a
  live food-order dashboard grouped by table with a bulk status workflow
  and the pre-event prep-quantity summary, an offer redemption scanner
  (same QR token as check-in), and a reports page (restaurant-wide
  summary plus a per-event drill-down).
- **web-user** — restaurant discovery, menu preview, event discovery
  (with bundled offers and a rating summary shown per event/restaurant),
  seated/general-admission checkout flow (seat hold → promo code →
  review → place order), PayHere redirect checkout or payment-proof
  upload, order history/cancellation with a subtotal/discount/total
  breakdown, a QR ticket view once an order is confirmed, a food
  pre-order form per ticket (browse the venue's menu, set
  quantities/notes, edit until the cutoff), a live notification bell,
  and post-event rating forms (the event itself, plus each pre-ordered
  dish) once an order is confirmed and the event has started.
- Full Docker Compose stack: Postgres (one database per service),
  Redis, RabbitMQ, MinIO, pgAdmin.

**Hardening (Phase 8):**
- Every backend service fails fast at startup with a clear error if a
  required environment variable is missing (`requireEnv()` in
  `@ceylon/nest-common`), instead of limping into a confusing downstream
  failure (e.g. TypeORM's opaque connection error when `DATABASE_URL` is
  undefined) — a Payment Service started without its PayHere merchant
  secret, for instance, refuses to start rather than silently issuing
  invalid checkout hashes.
- Every backend service calls `app.enableShutdownHooks()` so container
  orchestration's SIGTERM closes database/Redis/HTTP connections cleanly
  instead of killing the process mid-request.
- The API Gateway — the one publicly-exposed service — now sets security
  headers via `helmet` and restricts CORS to an explicit origin allowlist
  (`CORS_ALLOWED_ORIGINS`, defaulting to the three web portals' local-dev
  origins) instead of accepting any origin.
- Identity Service's `login`/`register`/`refresh` endpoints carry their
  own stricter per-IP rate limit (on top of the Gateway's own limit and
  this service's default), since those are exactly the endpoints a
  credential-stuffing or brute-force attempt would target.
- `payhere.util.ts`'s hash/signature functions (Payment Service) now have
  real unit tests with known-good MD5 vectors, replacing the vacuous
  `jest --passWithNoTests` every service still runs otherwise — see
  [Testing](#testing) below for what that does and doesn't cover.

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

## Testing

`pnpm test` runs every service's Jest suite. Only Payment Service has
real tests right now — `payhere.util.spec.ts` verifies the checkout-hash
and IPN-signature functions against known-good MD5 vectors, including
that tampering with the amount, status code, or merchant secret changes
the result. Every other service's `test` script is still
`jest --passWithNoTests`, i.e. it passes vacuously with zero assertions.
This build has been verified throughout by extensive manual curl-based
smoke testing against the live Docker stack after every phase (see each
phase's commit message for what was exercised), not by an automated
test suite — a real automated test suite covering the domain logic in
each service (order pricing/promo-code math, seat-hold/availability
checks, offer redemption caps, rating eligibility, etc.) is the most
valuable next investment for this codebase, beyond what this phase
covered.

## Production deployment notes

This build's Docker Compose setup is tuned for local development.
Deploying it for real needs at least:

- **Database migrations.** Every service runs TypeORM with
  `synchronize: true` in non-production `NODE_ENV`, and this repo has no
  migration files — schema changes throughout this whole build have
  applied directly via `synchronize`. Setting `NODE_ENV=production`
  turns `synchronize` off (see each service's `app.module.ts`), so a
  real production rollout needs either a one-time `synchronize` bootstrap
  against a fresh database before flipping `NODE_ENV`, or (better,
  before any real schema changes are needed) generating actual TypeORM
  migrations from the current entities and wiring a migration-run step
  into deployment. This is the single biggest gap between this build and
  a real production rollout.
- **Secrets.** Every credential in `.env.example` (`JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `INTERNAL_SERVICE_SECRET`, Postgres/MinIO/
  RabbitMQ/pgAdmin passwords) is a dev-only placeholder — rotate all of
  them to real secrets, sourced from a secrets manager rather than a
  committed `.env` file.
- **CORS.** Set `CORS_ALLOWED_ORIGINS` on the API Gateway to the real
  deployed web portal origins (it defaults to the three local-dev ports).
- **TLS.** The API Gateway speaks plain HTTP; put a reverse proxy or load
  balancer in front of it to terminate TLS — none of this build's
  services do so themselves.
- **PayHere.** Replace the sandbox merchant ID/secret/checkout URL with
  live credentials, and `API_GATEWAY_PUBLIC_URL` needs to be a publicly
  reachable HTTPS URL for PayHere's IPN webhook to reach.
- **Horizontal scaling caveats**, already noted inline in the relevant
  code: Food Order Service's and Notification Service's SSE live-update
  streams are in-memory pub/sub scoped to a single replica — scaling
  either horizontally needs that backed by Redis pub/sub (already
  running in this stack for seat holds) instead. General-admission
  ticket-tier quantity limits and promo-code usage-count increments are
  both best-effort checks, not perfectly race-safe under concurrent
  requests for the same tier/code — a real reservation/lock (like the
  seat holds already have) would be needed to close that gap under real
  concurrent load.
