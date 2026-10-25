# Clothing Commerce & Business Management Backend

Modular monolith on Node.js + Express + PostgreSQL + Sequelize.
This build covers **phases 1–18** of the roadmap: project setup, auth, RBAC,
users/customers, catalog + discovery, inventory, cart, promotions + checkout,
orders, payments, loyalty wallet + referral program, wishlist, reviews +
user-generated content (UGC), expenses + finance, marketing + analytics,
notifications, background jobs engine, versioned envelope encryption with KMS,
security hardening, test factories, and complete OpenAPI/Swagger documentation.

**New to this codebase? Read [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md) first** —
it explains the folder structure, the request lifecycle, what every dependency
is for, and gives a step-by-step recipe for adding a new module.

**Architecture & long-term principles? Read [`ARCHITECTURE_BLUEPRINT.md`](./ARCHITECTURE_BLUEPRINT.md)** —
the system design analysis, enterprise target architecture, zero-breakage migration strategy, and the 10-point Architectural Constitution governing Phases 14–25.

Every route is now documented at `/docs` (Swagger UI). Each endpoint's
`@openapi` block lives inside its controller function — see §4 of the
developer guide for why, and for the pattern to copy when you add a route.

## What's new in this build (phases 7–12 + extras)

| Area | Status |
| --- | --- |
| **Inventory** (`inventory`, `inventory_movements`) — reserve/release/commit with row-level locks (`SELECT ... FOR UPDATE`) so concurrent checkouts cannot oversell; purchases, damage, manual adjustments | Done |
| **Cart** (`carts`, `cart_items`) — guest + customer carts, per-variant quantity cap, live price/availability recompute on every read, guest→customer merge on login, cart expiry | Done |
| **Promotions engine** (`promotions`, `promotion_rules`, `coupons`, `coupon_redemptions`) — percentage/fixed, min order, product/category include & exclude, first-order-only, customer-specific, time windows, global + per-customer usage limits, max discount cap, stacking rules | Done |
| **Checkout** — one transaction: revalidate cart → resolve address → evaluate promotions → shipping → tax → optional wallet redemption → reserve stock → create order → clear cart. Idempotency-Key header support | Done |
| **Orders** (`orders`, `order_items`, `order_status_history`) — full fulfilment + returns state machine as a single transition table, item price/SKU/name snapshots, stock commit on confirm / restock on cancel-after-confirm or return | Done |
| **Payments** (`payments`, `refunds`) — provider interface + a deterministic mock adapter (`src/integrations/payments`), signature-verified/replay-safe/idempotent webhook handling, server-side amount cross-check, partial/full refunds | Done |
| **Loyalty wallet** (`wallets`, `wallet_transactions`) — append-only ledger, balance always derived (never stored), per-transaction expiry, balance can never go negative (row-locked debit) | Done |
| **Referrals** (`referrals`, `referral_events`) — link → signup → purchase → payment → delivery → return-window expiry → validated → reward, pluggable multi-signal fraud evaluator (`src/modules/referrals/fraud.evaluator.js`) | Done |
| **Wishlist** (`wishlist_items`) — nested under `/customers/:id/wishlist`, idempotent add, owner-or-staff scoped | Done |
| **Reviews** (`reviews`, `review_images`) — delivered & non-returned purchase verification, one review per customer per variant, rating (1–5), fit and quality feedback, helpful voting, admin moderation | Done |
| **UGC** (`ugc_submissions`, `ugc_rewards`) — customer submissions, order verification, admin verification, automatic reward issuance through loyalty wallet ledger (`UGC_CREDIT`) | Done |
| **Expenses** (`expense_categories`, `expenses`) — 9 core operational expense categories, period locking, receipt URL attachments, recurring rules, creator/approver tracking | Done |
| **Finance** (`financial_periods`) — Profit & Loss (P&L) generation over arbitrary date ranges, COGS computed directly from snapshotted `order_items.cost_price`, period closing and auditability | Done |
| **Marketing** (`campaigns`, `campaign_events`) — UTM tracking, campaign ROI attribution, event channels (Instagram/FB/WhatsApp/YouTube/Organic) | Done |
| **Analytics** — Indexed aggregated commerce intelligence across Sales, Customers, Products, Marketing, and Operations | Done |
| **Notifications** (`notifications`) — Multi-channel event bus (EMAIL, SMS, WHATSAPP, PUSH), transactional & marketing opt-in enforcement | Done |
| **Background Jobs** (`src/jobs/`) — Dual engine (BullMQ + Redis with in-process fallback), coupon/reward expiration, abandoned cart, low-stock alerts, review reminders, idempotency key pruning | Done |
| **Security & Envelope Encryption** (`encryption_keys`) — Versioned DEK envelope encryption (`v{ver}:{iv}:{tag}:{data}`), pluggable `LocalKmsProvider` (GCP/Vault ready), zero-downtime transactional re-encryption worker, magic byte file validator, IDOR isolation | Done |
| **Docker** — an `api` service alongside `postgres` and `redis` in `docker-compose.yml`, with its own `Dockerfile` (multi-stage, non-root, runs migrations then boots) | Done |

Everything from phases 1–6 (config, logging, error handling, auth, RBAC, users,
customers, catalog/discovery) is unchanged and still covered by its original tests;
see `PROMPT_CHAIN.md` for the phase-by-phase build history.

## Run it

```bash
cp .env.example .env      # fill in secrets for anything beyond local dev
docker compose up --build # postgres + redis + api, migrations run automatically
```

- API: `http://localhost:4000/api/v1`
- Docs: `http://localhost:4000/docs` (Swagger UI — click **Authorize** and paste an access token from `POST /auth/login` to try endpoints that need one)
- Health: `GET /api/v1/health/ready`

### Container networking

All three services (`postgres`, `redis`, `api`) sit on one explicit, named
Docker network: `commerce-network` (a bridge network declared at the bottom
of `docker-compose.yml`, not Compose's implicit default network). Each
service also has a fixed `container_name` — `commerce-postgres`,
`commerce-redis`, `commerce-api`.

Inside that network, Docker's embedded DNS resolves every container by its
name, so containers reach each other without knowing an IP:

- the `api` container connects to Postgres at `postgres:5432` and to Redis at
  `redis:6379` (see `DB_HOST`/`REDIS_URL` in the `api` service's
  `environment:` block) — `postgres` and `redis` here are the *container/
  service names*, not `localhost`
- from inside any container on the network you can `ping commerce-postgres`
  or `curl commerce-api:4000/api/v1/health/live` and it resolves

This only works for containers attached to `commerce-network`. Your host
machine is not on that network, so from your own terminal you still use the
published ports (`localhost:5432`, `localhost:6379`, `localhost:4000`) — the
`ports:` lines in `docker-compose.yml`.

**Adding another container that needs to talk to this stack** (a worker, an
admin UI like pgAdmin, a second API, ...): either add it as a service in this
same `docker-compose.yml` (it joins `commerce-network` automatically if you
list it under `networks:` the same way `api` does), or, if it's started
separately, attach it to the already-running network explicitly:

```bash
docker network connect commerce-network <your-container-name>
# then, from inside that container:
curl http://commerce-api:4000/api/v1/health/live
```

Check what's on the network at any time with:
```bash
docker network inspect commerce-network
```

Without Docker:
```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Tests: create a `clothing_commerce_test` database, then `npm test`.

> **Note on this delivery:** this environment has no network access, so
> `npm install` could not be run here and the test suite could not be executed
> against a live Postgres/Redis. Every file has been syntax-checked
> (`node --check`), and phases 1–6's original test files are reproduced
> unmodified so `npm test` will re-verify nothing broke once you install
> dependencies locally or via Docker.

## New conventions introduced in phases 7–12

- **Optional cross-module hooks are always wrapped in try/catch.** e.g. `product.service.create` seeds inventory, `auth.service.register` creates the customer profile and records a referral signup, `order.service.transition` notifies referrals and applies customer stats — none of these can break their caller if the other module is mocked out or briefly unavailable.
- **Every stock or ledger mutation is append-only + row-locked.** `inventory.repository.findByVariantForUpdate` and `wallet.repository.findByCustomerForUpdate` use `SELECT ... FOR UPDATE`; nothing computes availability or balance from a cached column.
- **`utils/idempotency.js`** is the shared guard for any POST that must not double-execute (checkout, payment webhooks): a completed request replays its stored response instead of re-running side effects.
- **The order lifecycle lives in one place**: `src/modules/orders/order.transitions.js`. Every caller — the HTTP layer, the payment webhook, tests — goes through `canTransition()`/`order.service.transition()` rather than writing `status` directly.
- **Snapshots, not references, for anything financial.** Order items freeze product name/SKU/price/cost at order time; cart items keep a `priceAtAdd` snapshot purely to flag drift, but totals are always recomputed from the live price.
- **Swagger docs live in the controller, not the route file.** Every `@openapi` block sits as the first line inside its controller function; `docs/swagger.js` scans `*.controller.js` files, not `*.routes.js`. See `DEVELOPER_GUIDE.md` §4.

## Conventions carried over from phases 1–6

```
routes → controller → validation → service → repository → model → postgres
```

- Controllers touch HTTP only. Services hold business logic and own transactions. Repositories are the only place Sequelize is called.
- Every route gets a Joi schema through `middleware/validate` and an `@openapi` JSDoc block.
- Errors are thrown as `ApiError`; nothing formats its own error response.
- Never trust client-supplied price, stock, permissions, discounts, rewards or order state.
- Schema changes go through migrations only; `sequelize.sync()` is never used.

## Notes

- `npm install` was not run in the authoring environment (no network), so the lockfile is absent — install locally or let the Docker build generate it.
- `users.mfa_secret_encrypted` is a placeholder for the KEK/DEK encryption service introduced in a later phase.
- The payments provider is `mock` by default (`PAYMENTS_PROVIDER=mock`); it never calls out to the network and signs webhooks with `PAYMENTS_WEBHOOK_SECRET` using HMAC-SHA256, exactly like a real gateway would.
- `src/modules/referrals/fraud.evaluator.js` and `src/modules/auth/mfa/mfa.provider.js` follow the same pluggable-seam pattern: business code calls one function and never branches on the implementation.

## Remaining phases (14–25)

Expenses/finance, marketing/analytics, notifications + background
jobs, security hardening/encryption, and test/documentation completion — see
`PROMPT_CHAIN.md` for the prompt to run for each.
