# Prompt chain — remaining phases

Use one prompt per session. Paste the **standing preamble** first, then the phase prompt.
Attach the original spec document each time; attach the repo (or a zip/diff of it) so the session builds on real code.

---

## Standing preamble (paste at the start of every session)

> You are continuing an in-progress backend: a clothing-brand commerce + business management platform.
> Stack: Node.js, Express, PostgreSQL, Sequelize, Joi, Swagger (swagger-jsdoc), Jest + Supertest, pino.
> Architecture: modular monolith, domain-based — `src/modules/<domain>/{*.controller,*.service,*.repository,*.routes,*.validation,*.model}.js`.
> Flow: routes → controller → validation → service → repository → Sequelize model → Postgres.
> Already built (phases 1–12): env-validated config, pino logging with redaction, request IDs, central error handler + `ApiError`, single response envelope in `utils/apiResponse`, Joi `validate` middleware, helmet/CORS/compression/rate limiting, Sequelize instance + model auto-registry, migrations through phase 12, seeder for roles + permission matrix + admin user + settings, Swagger UI at `/docs`, health module, Jest harness. Auth, RBAC, users, customers (with wishlist), catalog + discovery, inventory (reserve/release/commit, row-locked), cart (guest+customer, merge on login), promotions engine + checkout (one transaction, idempotency-key aware), orders (single transition-table state machine), payments (provider seam + mock adapter, signature-verified idempotent webhooks, refunds), loyalty wallet (append-only ledger, derived balance), referrals (multi-signal pluggable fraud evaluator). Docker: `api` service alongside `postgres`/`redis` in `docker-compose.yml`.
> Rules: reuse the existing utilities — do not invent a second error class, response shape, or validation pattern. Migrations only, no `sync()`. Transactions for any multi-write operation. Never trust client-supplied price, stock, permissions, discounts, rewards or order state. Every route needs a Joi schema and an `@openapi` JSDoc block. Every module needs Jest tests including negative cases. Register new routes in `src/modules/index.js`. Cross-module hooks that reach into a module which might not be loaded/mocked go through a lazy `require()` wrapped in try/catch (see `auth.service.register`, `order.service.transition` for the pattern).
> Deliver only the phase I name. End with: files added/changed, migration commands to run, and what the next phase inherits.

---

## Phase 4 — Auth (DONE)
## Phase 5 — RBAC + Users + Customers (DONE)
## Phase 6 — Products, categories, collections, variants (DONE)
## Phase 7 — Inventory (DONE)
## Phase 8 — Cart (DONE)
## Phase 9 — Checkout + Promotions engine (DONE)
## Phase 10 — Orders (DONE)
## Phase 11 — Payments (DONE)
## Phase 12 — Loyalty/wallet ledger + Referrals (DONE)

## Phase 13 — Reviews + UGC (NEXT)
> Build `reviews` and `review_images`: only for delivered, eligible, non-returned purchases; verified-purchase flag; rating, text, images, fit and quality fields; one review per customer per variant; moderation status. Build `ugc_submissions` and `ugc_rewards`: submission → order verification → admin verification → reward issued through the wallet ledger (reuse `loyalty/wallet.service.credit`). Reward submission and verification, never sentiment or rating.

## Phase 14 — Expenses + Finance
> Build `expense_categories` and `expenses` (amount, category, date, vendor, payment method, description, receipt file, recurring rules) covering manufacturing, fabric, packaging, shipping, marketing, software, salaries, office, transportation. Then the finance module computing Revenue, COGS (from `order_items.cost_price`, already snapshotted at order time), Gross Profit, Operating Expenses, Other Costs, Net Profit over a date range, with every figure traceable to source records and no destructive edits to posted periods.

## Phase 15 — Marketing + Analytics
> Build `campaigns` and `campaign_events` (audience, budget, channel — Instagram/Facebook/YouTube/WhatsApp/Organic/Referral/Direct — discounts, acquisition-source tracking on customers and orders). Then analytics endpoints: sales (revenue, orders, AOV, units, conversion), customers (new, returning, repeat rate, LTV), products (best/slow sellers, profitability, size and color popularity — `products.sales_count` and `product_views` already feed this), marketing (referral conversions via `referral_events`, campaign performance, acquisition source, UGC), operations (return rate from `order_status_history`, cancellation rate, delivery performance, inventory turnover from `inventory_movements`). Use indexed aggregate queries; keep them behind a service that a materialized-view or job-based implementation can replace.

## Phase 16 — Notifications + Background jobs
> Build an event bus and `notifications` table for ORDER_CONFIRMED, PAYMENT_SUCCESS, ORDER_SHIPPED, ORDER_DELIVERED, REWARD_EARNED, REWARD_EXPIRING, REFERRAL_SUCCESS, BACK_IN_STOCK, NEW_DROP, with a channel-adapter interface (email/SMS/WhatsApp/push) and strict respect for marketing preferences and opt-outs. Then wire `src/jobs/` with BullMQ + Redis behind the `REDIS_ENABLED` flag and an in-process fallback: reward expiration (`wallet_transactions.expires_at` already tracks this), coupon expiration, abandoned cart (`carts.expires_at`), low-stock alerts, review reminders, birthday rewards, campaign notifications, analytics processing, report generation. Synchronous V1 flows must still work with Redis off.

## Phase 17 — Security hardening + encryption seam
> Add the KEK → DEK → ciphertext encryption service behind a reusable interface (envelope encryption, key rotation support, no business module aware of the mechanism) and apply it to the fields already reserved for it (`users.mfa_secret_encrypted`). Harden: secure file uploads (type/size/scan, signed URLs) for review images and UGC, CSRF where cookie auth applies, session/refresh-token management and global revocation, audit-log coverage review, the `idempotency_keys` store (already used by checkout/webhooks) audited for cleanup of abandoned IN_PROGRESS rows, secret handling review, and a dependency/security pass. Add security-focused tests: authorization bypass attempts, IDOR on every customer-scoped resource (including wishlist and wallet), mass-assignment, rate-limit behaviour.

## Phase 18 — Test + documentation completion
> Raise coverage across services, controllers and endpoints with the negative cases named in the spec (auth, authorization, validation, checkout, pricing, promotions, inventory, order transitions, payments, referrals, loyalty ledger). Add test factories and a transactional test database strategy. Then audit Swagger: every route documented with request/response schemas, auth requirements, parameters and error responses, plus a CI check that fails when a route lacks an `@openapi` block.
