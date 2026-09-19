# Clothing Commerce & Business Management Backend

Modular monolith on Node.js + Express + PostgreSQL + Sequelize.
This repository is being built in phases; **this slice covers phases 1–6** of the 25-phase plan:
project setup, configuration, the database/Sequelize foundation, authentication, RBAC, users/customers and the product catalogue with search and discovery.

## What exists now

| Area | Status |
| --- | --- |
| Project layout (`src/modules/*`, `middleware`, `jobs`, `integrations`, `utils`, `config`, `docs`) | Done |
| Env-validated config (Joi), fail-fast on boot | Done |
| Structured logging (pino) with secret redaction + request IDs | Done |
| Central error handler, `ApiError`, Sequelize error mapping | Done |
| Single response envelope (`success` / `paginated`) | Done |
| Joi validation middleware (strips unknown fields, reports all errors) | Done |
| Helmet, CORS, compression, rate limiting (global + auth bucket) | Done |
| Sequelize instance, model auto-registry, association wiring | Done |
| Migrations: `roles`, `permissions`, `users`, `user_roles`, `role_permissions`, `audit_logs`, `settings` | Done |
| Seeder: system roles, full permission matrix, admin user, base settings | Done |
| Swagger/OpenAPI generated from route JSDoc + Swagger UI at `/docs` | Done |
| Health module (`/health/live`, `/health/ready`) as the reference vertical slice | Done |
| Jest + Supertest harness with negative cases | Done |
| Auth: register, login, logout, refresh rotation, password reset | Done |
| Migrations: `refresh_tokens`, `password_reset_tokens` | Done |
| `authenticate` middleware (`req.user`), account lockout, MFA seam | Done |
| RBAC `authorize()` / `authorizeSelfOr()` with per-request permission cache | Done |
| Audit-log writer used by every privileged mutation | Done |
| Users module (admin CRUD, role assignment, status changes) | Done |
| Customers module: profiles, addresses, marketing opt-outs, derived spend stats | Done |
| Catalog: categories, collections, products, variants, images | Done |
| Discovery: trigram + full-text search, filters, facets, new arrivals, best sellers, trending, related, recently viewed | Done |
| Inventory, cart, checkout, orders, payments, everything else | **Next phases** |

## Setup

```bash
cp .env.example .env          # fill in DB credentials
docker compose up -d postgres # or point at your own Postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

- API: `http://localhost:4000/api/v1`
- Docs: `http://localhost:4000/docs`
- Health: `GET /api/v1/health/ready`

Tests: create a `clothing_commerce_test` database, then `npm test`.

## Conventions every future module must follow

```
routes → controller → validation → service → repository → model → postgres
```

- Controllers touch HTTP only: parse `req`, call a service, return via `utils/apiResponse`.
- Services hold business logic and own transactions.
- Repositories are the only place Sequelize is called.
- Models live in their module as `*.model.js` and are auto-loaded by `src/models/index.js`.
- Every route gets a Joi schema through `middleware/validate`.
- Every route gets an `@openapi` JSDoc block — docs are generated, never hand-maintained.
- Errors are thrown as `ApiError`; nothing formats its own error response.
- Never trust client-supplied price, stock, permissions, discounts, rewards or order state.
- Schema changes go through migrations only; `sequelize.sync()` is never used.

## Notes

- `npm install` was not run in the authoring environment (no network), so the lockfile is absent — install locally to generate it.
- Redis/BullMQ is off by default (`REDIS_ENABLED=false`); `src/jobs/` and `src/integrations/` are reserved and empty.
- `users.mfa_secret_encrypted` is a placeholder for the KEK/DEK encryption service introduced in a later phase.

## Phase 5-6 notes

- `authorize('products:create')` resolves user -> roles -> permissions from the database on each request (cached on `req`), so a revoked role takes effect immediately rather than when the token expires. Admins hold an implicit `*`.
- `authorizeSelfOr('users:read')` is the IDOR guard: owners pass on their own id, everyone else needs the permission.
- `audit.service.record(req, {...})` accepts the caller's transaction, so the audit row commits with the change it describes, and it scrubs password hashes and token hashes.
- Customer spend, order count and last purchase are denormalised columns written only by the orders phase; AOV is always computed. Any client attempt to set them is stripped in the service.
- Partial unique indexes enforce one default shipping address and one default billing address per customer at the database level, not only in code.
- Variant `price` is nullable and means "inherit the parent product price"; the resolved value is returned as `effectivePrice`. `costPrice` never appears on public responses.
- Search uses a GIN trigram index on `products.name` plus a full-text index over name/description/tags. Sorting is whitelisted, so nothing user-supplied reaches the ORDER BY clause.
- `product_views` powers trending (views in a window) and recently-viewed (per customer, or per `X-Session-Id` for guests); trending falls back to best sellers while the table is cold. `products.sales_count` is populated by the orders phase.

## Auth notes

- Refresh tokens are opaque random strings; only their SHA-256 hash is stored, so a database dump cannot be replayed.
- Rotation on every refresh. Presenting an already-revoked token is treated as theft: every session for that user is revoked.
- Lockout after `AUTH_MAX_FAILED_ATTEMPTS` failures for `AUTH_LOCK_MINUTES`; login returns one generic 401 whether the email exists or not.
- Password reset tokens are single-use, hashed, and a successful reset revokes every refresh token. Outside production the token is returned in the response body until the notifications module can deliver it.
- `src/modules/auth/mfa/mfa.provider.js` is an interface with a no-op implementation; TOTP drops in behind it without touching the auth service.