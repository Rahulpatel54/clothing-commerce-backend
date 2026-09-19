# Prompt chain — remaining phases

Use one prompt per session. Paste the **standing preamble** first, then the phase prompt.
Attach the original spec document each time; attach the repo (or a zip/diff of it) so the session builds on real code.

---

## Standing preamble (paste at the start of every session)

> You are continuing an in-progress backend: a clothing-brand commerce + business management platform.
> Stack: Node.js, Express, PostgreSQL, Sequelize, Joi, Swagger (swagger-jsdoc), Jest + Supertest, pino.
> Architecture: modular monolith, domain-based — `src/modules/<domain>/{*.controller,*.service,*.repository,*.routes,*.validation,*.model}.js`.
> Flow: routes → controller → validation → service → repository → Sequelize model → Postgres.
> Already built (phases 1–6): env-validated config, pino logging with redaction, request IDs, central error handler + `ApiError`, single response envelope in `utils/apiResponse`, Joi `validate` middleware, helmet/CORS/compression/rate limiting, Sequelize instance + model auto-registry, migrations for roles/permissions/users/user_roles/role_permissions/audit_logs/settings, seeder for roles + permission matrix + admin user + settings, Swagger UI at `/docs`, health module as the reference slice, Jest harness. Auth: `refresh_tokens` and `password_reset_tokens` tables, register/login/logout/refresh-rotation/password-reset, `token.service.js` (JWT access + hashed opaque refresh), `middleware/authenticate.js` populating `req.user` with roles and permissions, account lockout, and an MFA provider seam. RBAC: `middleware/authorize.js` (`authorize`, `authorizeSelfOr`) backed by `modules/users/rbac.service.js`, and `modules/audit/audit.service.js` for audit rows. Users module (admin CRUD, roles, status), customers module (`customers`, `addresses`, marketing preferences, read-only spend stats), and the catalogue: `categories`, `collections`, `products`, `product_variants`, `product_images`, `product_collections`, `product_views`, with search, filters, facets, new arrivals, best sellers, trending, related and recently viewed.
> Rules: reuse the existing utilities — do not invent a second error class, response shape, or validation pattern. Migrations only, no `sync()`. Transactions for any multi-write operation. Never trust client-supplied price, stock, permissions, discounts, rewards or order state. Every route needs a Joi schema and an `@openapi` JSDoc block. Every module needs Jest tests including negative cases. Register new routes in `src/modules/index.js`.
> Deliver only the phase I name. End with: files added/changed, migration commands to run, and what the next phase inherits.

---

## Phase 4 — Auth (DONE)
> Build the `auth` module: register, login, logout, refresh-token rotation, password reset (request + confirm), and the `refresh_tokens` table (hashed token, device/user-agent, IP, expiry, revoked_at, replaced_by). Add bcrypt hashing, JWT access/refresh issuance, `authenticate` middleware populating `req.user`, account lockout after N failed attempts using `failed_login_attempts`/`locked_until`, and the stricter `authLimiter` on login and reset routes. Add an MFA architecture seam (interface + no-op implementation) without implementing TOTP yet. Tests: happy paths plus wrong password, locked account, reused/revoked refresh token, expired token, and reset-token replay.

## Phase 5 — RBAC + Users + Customers (DONE)
> Build `authorize(...permissions)` middleware resolving user → roles → permissions with a per-request cache, plus an `audit_logs` writer service used by privileged mutations. Build the `users` module (admin CRUD, role assignment, status changes) and the `customers` module: `customers` and `addresses` tables, customer profile linked to `users`, default address handling, marketing preferences and opt-outs, and derived stats (total spend, AOV, order count, last purchase) exposed read-only. Tests: permission denial per role, self-vs-admin access, address default invariants.

## Phase 6 — Products, categories, collections, variants (DONE)
> Build `categories`, `collections`, `products`, `product_variants`, `product_images`. Variants are separate SKU entities sharing a parent product (size, color, SKU, price override). Include name, description, price, compareAtPrice, costPrice, SKU, status, tags, material, GSM, fit. Add slug generation, unique SKU constraints, admin CRUD, and public read endpoints. Then add search/discovery: full-text/trigram search, category and attribute filters, sorting, new arrivals, best sellers, trending, related products, recently viewed — structured so a recommendation engine can slot in later.

## Phase 7 — Inventory (NEXT)
> Build `inventory` (per-variant physical, reserved, sold, returned, damaged) and immutable `inventory_movements` (PURCHASE, ORDER, RETURN, DAMAGE, ADJUSTMENT) with actor and reference. Expose available = physical − reserved. Implement reserve/release/commit operations using transactions with `SELECT ... FOR UPDATE` row locks so concurrent checkouts cannot oversell. Tests must include a concurrent-reservation test proving no oversell and that movements are append-only. Wire `products.sales_count` to be incremented when an order commits stock, since discovery already reads it.

## Phase 8 — Cart
> Build `carts` and `cart_items`: guest and customer carts, merge on login, per-variant quantity limits, availability checks, server-recomputed line and cart totals on every read, price-change detection, cart expiry, and stock reservation hooks into the inventory service. Reject any client-supplied price or total. Tests: stale price, out-of-stock variant, quantity cap, expiry, guest→customer merge.

## Phase 9 — Checkout + Promotions engine
> Build the promotion/rule engine first (`coupons`, `promotions`, `promotion_rules`): percentage/fixed discounts, minimum order, product/category restrictions and exclusions, first-order, customer-specific, time windows, global and per-customer usage limits, max discount cap, and stacking rules — all evaluated server-side. Then the checkout service: address → shipping → coupon → rewards → tax → `subtotal + shipping + tax − discounts − rewards = final amount`, computed entirely on the server inside one transaction, with stock reserved and an idempotency key on the checkout endpoint. Tests: every rule type, stacking conflicts, expired/exhausted coupons, tampered totals.

## Phase 10 — Orders
> Build `orders`, `order_items`, `order_status_history`. Implement the state machine (PENDING → CONFIRMED → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED, plus PENDING → CANCELLED and DELIVERED → RETURN_REQUESTED → RETURN_APPROVED → RETURNED → REFUNDED) as a single transition table; reject invalid transitions with 409 and record every transition with actor, reason and timestamp. Snapshot item price/SKU/product name at order time. Wire inventory commit on confirm and restock on cancel/return.

## Phase 11 — Payments
> Build `payments` and `refunds` behind `integrations/payments/` with a provider interface plus one concrete adapter. Implement payment creation, verification, webhook handling with signature verification, replay protection and idempotency, server-side amount verification against the order, refund initiation, and payment status tracking that drives order transitions. Webhooks must be safe to receive twice and out of order. Tests: forged signature, duplicate webhook, amount mismatch, partial refund.

## Phase 12 — Loyalty/wallet ledger + Referrals
> Build `wallets` and `wallet_transactions` as an append-only ledger (balance is always derived, never stored mutably): purchase, referral, UGC, birthday, campaign, compensation credits; redemption and expiration debits; per-transaction expiry dates. Then `referrals` and `referral_events` implementing link → signup → purchase → payment success → delivery → return window expiry → validated → reward issued, with the fraud-signal schema in place (IP, phone, device, address reuse, account patterns, referral velocity, cancellation/return history) scored by a pluggable evaluator that never relies on one signal. Tests: ledger never goes negative, expiry math, referral cannot validate before the return window closes.

## Phase 13 — Reviews + UGC
> Build `reviews` and `review_images`: only for delivered, eligible, non-returned purchases; verified-purchase flag; rating, text, images, fit and quality fields; one review per customer per variant; moderation status. Build `ugc_submissions` and `ugc_rewards`: submission → order verification → admin verification → reward issued through the wallet ledger. Reward submission and verification, never sentiment or rating.

## Phase 14 — Expenses + Finance
> Build `expense_categories` and `expenses` (amount, category, date, vendor, payment method, description, receipt file, recurring rules) covering manufacturing, fabric, packaging, shipping, marketing, software, salaries, office, transportation. Then the finance module computing Revenue, COGS (from variant costPrice at order time), Gross Profit, Operating Expenses, Other Costs, Net Profit over a date range, with every figure traceable to source records and no destructive edits to posted periods.

## Phase 15 — Marketing + Analytics
> Build `campaigns` and `campaign_events` (audience, budget, channel — Instagram/Facebook/YouTube/WhatsApp/Organic/Referral/Direct — discounts, acquisition-source tracking on customers and orders). Then analytics endpoints: sales (revenue, orders, AOV, units, conversion), customers (new, returning, repeat rate, LTV), products (best/slow sellers, profitability, size and color popularity), marketing (referral conversions, campaign performance, acquisition source, UGC), operations (return rate, cancellation rate, delivery performance, inventory turnover). Use indexed aggregate queries; keep them behind a service that a materialized-view or job-based implementation can replace.

## Phase 16 — Notifications + Background jobs
> Build an event bus and `notifications` table for ORDER_CONFIRMED, PAYMENT_SUCCESS, ORDER_SHIPPED, ORDER_DELIVERED, REWARD_EARNED, REWARD_EXPIRING, REFERRAL_SUCCESS, BACK_IN_STOCK, NEW_DROP, with a channel-adapter interface (email/SMS/WhatsApp/push) and strict respect for marketing preferences and opt-outs. Then wire `src/jobs/` with BullMQ + Redis behind the `REDIS_ENABLED` flag and an in-process fallback: reward expiration, coupon expiration, abandoned cart, low-stock alerts, review reminders, birthday rewards, campaign notifications, analytics processing, report generation. Synchronous V1 flows must still work with Redis off.

## Phase 17 — Security hardening + encryption seam
> Add the KEK → DEK → ciphertext encryption service behind a reusable interface (envelope encryption, key rotation support, no business module aware of the mechanism) and apply it to the fields already reserved for it. Harden: secure file uploads (type/size/scan, signed URLs), CSRF where cookie auth applies, session/refresh-token management and global revocation, audit-log coverage review, idempotency key store, secret handling review, and a dependency/security pass. Add security-focused tests: authorization bypass attempts, IDOR on every customer-scoped resource, mass-assignment, rate-limit behaviour.

## Phase 18 — Test + documentation completion
> Raise coverage across services, controllers and endpoints with the negative cases named in the spec (auth, authorization, validation, checkout, pricing, promotions, inventory, order transitions, payments, referrals, loyalty ledger). Add test factories and a transactional test database strategy. Then audit Swagger: every route documented with request/response schemas, auth requirements, parameters and error responses, plus a CI check that fails when a route lacks an `@openapi` block.