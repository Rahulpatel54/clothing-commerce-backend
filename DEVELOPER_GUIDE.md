# Developer Guide

Read this once before touching the code. It explains what's where, why the
codebase is shaped the way it is, what every package is doing, and gives you a
copy-paste recipe for adding a new feature the same way everything else here
was built. Companion docs: `README.md` (what's built, how to run it),
`PROMPT_CHAIN.md` (phase-by-phase history and what's still to build), and
`ARCHITECTURE_BLUEPRINT.md` (system design analysis and the 10-point Architectural Constitution).

---

## 1. The mental model

This is a **modular monolith**: one Express process, one Postgres database,
but the code is organized as if each business domain (`auth`, `products`,
`orders`, `payments`, ...) were its own mini-service living in its own folder
under `src/modules/`. Nothing outside a module reaches into its internals
directly — modules talk to each other through a service's exported functions,
never through another module's repository or model.

Every request flows through the same five layers, in the same order, no
exceptions:

```
routes.js → controller.js → validation.js (via middleware) → service.js → repository.js → model.js → Postgres
```

- **`*.routes.js`** — wires an HTTP method + path to a controller function, with
  `authenticate`/`authorize`/`validate` middleware in between. No logic here.
- **`*.controller.js`** — translates HTTP ↔ JavaScript. Pulls values off `req`,
  calls exactly one service function, sends the response with
  `utils/apiResponse.js`. No business logic, no direct database access. **This
  is also where the Swagger docs for that endpoint live** — see §4.
- **`*.validation.js`** — a Joi schema per route, consumed by
  `middleware/validate.js`. Strips unknown fields and coerces types before the
  controller ever sees `req.body`/`req.query`/`req.params`.
- **`*.service.js`** — the business logic. Owns transactions, enforces
  authorization rules that depend on data (e.g. "is this the order's owner?"),
  calls other modules' services for cross-cutting effects, throws `ApiError`
  for anything that isn't a happy path.
- **`*.repository.js`** — the *only* place Sequelize query methods
  (`findOne`, `create`, `update`, ...) are called for that module. Keeps every
  raw query in one place per domain, so a schema change or a query
  optimization never means hunting through business logic.
- **`*.model.js`** — a Sequelize model definition, auto-loaded by
  `src/models/index.js` (it recursively scans `src/modules/**/*.model.js`, so
  a new model file just needs to exist — nothing to register).

If you're ever unsure where a piece of code goes, ask "does this talk to the
database?" (repository), "does this decide whether an action is allowed or
what happens next?" (service), or "does this parse an HTTP request?"
(controller).

---

## 2. Folder-by-folder map

```
src/
  app.js              Express app assembly: middleware order, mounts /docs and the API router
  server.js           Boots app.js, connects the DB, handles graceful shutdown
  config/
    index.js          Loads .env, validates every variable with Joi, exports a typed config object
    database.js        Sequelize dialect options, read by both config/sequelize.js and sequelize-cli
    sequelize.js       The one Sequelize instance every repository imports
    logger.js          pino logger with secret redaction
  middleware/
    authenticate.js    Verifies the JWT, loads the user, sets req.user
    authorize.js        authorize(...perms) and authorizeSelfOr(...perms) — the RBAC gate
    validate.js         Runs a module's Joi schema against params/query/body
    rateLimiter.js       Global + stricter "auth" rate-limit buckets
    errorHandler.js      The only place an error response is formatted (maps Sequelize/ApiError → JSON)
    requestId.js / requestLogger.js   Per-request UUID + structured request logging
  utils/
    ApiError.js         Typed HTTP errors (ApiError.notFound(), .conflict(), ...)
    apiResponse.js       success()/paginated() — the one response envelope every endpoint uses
    catchAsync.js        Wraps an async controller so a rejected promise reaches errorHandler
    pagination.js        Reads page/limit off req.query with sane defaults/caps
    slugify.js            Turns a name into a unique URL slug
    idempotency.js         Shared guard for POSTs that must not double-execute (checkout, webhooks)
  integrations/payments/  Payment provider seam: provider.interface.js is the contract, mock.adapter.js
                          is the offline implementation actually used by default
  modules/<domain>/      One folder per business domain — see §3
  database/
    migrations/          One file per schema change, run in filename order, never edited after merge
    seeders/              Inserts roles/permissions/admin user/base settings
  models/index.js        Auto-loads every *.model.js and wires their .associate()
  docs/swagger.js         Builds the OpenAPI spec from JSDoc comments — see §4
tests/                    One *.test.js per service/module, using Jest + jest.mock() on repositories
```

---

## 3. What's inside a module folder

Take `src/modules/inventory/` as a representative example:

| File | Job |
| --- | --- |
| `inventory.model.js` | The `Inventory` Sequelize model (physical/reserved/sold/returned/damaged columns) |
| `inventoryMovement.model.js` | The append-only `InventoryMovement` ledger model |
| `inventory.repository.js` | `findByVariantForUpdate` (row-locked read), `save`, `createMovement`, ... — every raw query |
| `inventory.service.js` | `reserve()`, `release()`, `commit()`, `adjust()` — the actual business rules (never oversell, etc.) |
| `inventory.validation.js` | Joi schemas for each route body/params |
| `inventory.controller.js` | HTTP handlers, each with its own `@openapi` doc block |
| `inventory.routes.js` | `router.post('/receive', authorize(...), validate(...), controller.receive)` etc. |

Not every module has every file — `taxonomy.service.js` in `products/` is
shared by both `category.controller.js` and `collection.controller.js`
because categories and collections are the same shape of CRUD; a module like
`checkout/` has no model at all because it only orchestrates other modules'
services inside one transaction.

**Cross-module calls always go through the other module's service**, and
when the call is a "nice to have" side effect (e.g. auth creating a customer
profile on register, or an order transition notifying referrals) it's a
**lazy `require()` wrapped in `try/catch`** so a missing or mocked module
never breaks the caller:

```js
// src/modules/auth/auth.service.js
try {
  const customerService = require('../customers/customer.service');
  await customerService.createForUser(user.id, {}, transaction);
} catch (err) {
  logger.warn({ err, userId: user.id }, 'Could not create customer profile on register');
}
```

Search the codebase for `/* eslint-disable-next-line global-require */` to
find every one of these seams — that comment always marks "this call is
optional, look at the try/catch around it."

---

## 4. Swagger / OpenAPI docs — and why `/docs` was blank before

`src/docs/swagger.js` uses `swagger-jsdoc`, which scans a set of files for
`/** @openapi ... */` comment blocks and stitches them into one OpenAPI spec.
**It does not care where in a file the comment sits** — it just needs the
comment to exist somewhere in a file that's on its scan list.

The `/docs` page looked empty before because two things were true at once:
1. Several modules (auth, users, products, customers, promotions) had **no**
   `@openapi` blocks anywhere.
2. The ones that did exist lived only in `*.routes.js`.

Both are fixed now: **every** controller function has its own `@openapi`
block as the first line inside the function body, and `swagger.js`'s `apis`
glob now points at `modules/**/*.controller.js` instead of `*.routes.js`.
Route files are intentionally left undocumented now — the controller is the
single source of truth, so there's never a question of which copy is current.

```js
const get = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users/{id}:
   *   get:
   *     tags: [Users]
   *     summary: Get a user (self or admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: User }
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  return success(res, { data: await service.get(req.params.id) });
});
```

**Adding a new endpoint?** Copy the pattern above: method + path under
`@openapi`, a `tags` entry matching one of the tags already listed in
`docs/swagger.js`, `security: [{ bearerAuth: [] }]` if it needs a token, and
a `responses` map with at least the success code. Request bodies use inline
JSON-Schema-ish YAML (see any `POST`/`PATCH` handler for examples) rather than
a separate `components.schemas` entry, to keep the doc next to the code it
describes.

Open `http://localhost:4000/docs` after starting the server, click
**Authorize**, paste in an access token (get one from `POST /auth/login`),
and every documented route becomes runnable from the page.

---

## 5. What each dependency is for

| Package | Role |
| --- | --- |
| `express` | The HTTP framework — routing, middleware pipeline |
| `sequelize` + `pg`/`pg-hstore` | ORM + Postgres driver. Models, migrations, transactions, `SELECT ... FOR UPDATE` locks all go through this |
| `sequelize-cli` | Runs migrations/seeders from the command line (`npm run db:migrate`) |
| `joi` | Schema validation for every request body/query/params, and for `.env` itself (`config/index.js`) |
| `jsonwebtoken` | Signs/verifies the short-lived access token |
| `bcrypt` | Password hashing (also used to hash nothing else — refresh/reset tokens use SHA-256 via `crypto`, see `token.service.js`) |
| `helmet` | Sets security-related HTTP headers |
| `cors` | Configures allowed origins (`CORS_ORIGINS` in `.env`) |
| `compression` | Gzips responses |
| `express-rate-limit` | Backs `middleware/rateLimiter.js` (a global bucket + a stricter one for auth routes) |
| `pino` + `pino-http` | Structured JSON logging with automatic secret redaction, one log line per request |
| `swagger-jsdoc` + `swagger-ui-express` | Builds and serves the `/docs` page described in §4 |
| `dotenv` | Loads `.env` into `process.env` before `config/index.js` validates it |
| `uuid` | Not directly used much — Postgres generates UUIDs via `gen_random_uuid()` (migrations) / `DataTypes.UUIDV4` (models) — kept for any code that needs a UUID outside a DB round-trip |
| `jest` + `supertest` | Test runner + HTTP assertions against `src/app.js` without actually binding a port |
| `cross-env` | Sets `NODE_ENV=test` cross-platform for the `npm test` script |

Two integration seams worth knowing about even though they're not npm
packages:
- **`src/integrations/payments/`** — `provider.interface.js` documents the
  contract (`createPayment`, `verifyWebhookSignature`, `parseWebhookEvent`,
  `refund`); `mock.adapter.js` is the only implementation right now and never
  touches the network. Swap `PAYMENTS_PROVIDER` in `.env` and add a new
  adapter file to integrate a real gateway later.
- **`src/modules/referrals/fraud.evaluator.js`** and
  **`src/modules/auth/mfa/mfa.provider.js`** are the same kind of pluggable
  seam for fraud scoring and MFA respectively.

---

## 6. How a request actually flows (worked example)

`PATCH /api/v1/orders/:id/status` — a staff member marks an order `CONFIRMED`:

1. **`app.js`** — request hits `helmet`, `cors`, `compression`,
   `express.json()`, the global rate limiter, then `config.apiPrefix`
   (`/api/v1`) dispatches into `src/modules/index.js`.
2. **`src/modules/index.js`** — routes `/orders` to `order.routes.js`.
3. **`order.routes.js`** — `authenticate` verifies the JWT and sets
   `req.user`; a small inline middleware resolves `req.customerId`;
   `authorize('orders:update')` checks the caller's permission (see §7);
   `validate(schema.transition)` runs the Joi schema from
   `order.validation.js`, stripping anything not in the schema; finally
   `controller.transition` runs.
4. **`order.controller.js`** — pulls `status`/`reason` out of the now-trusted
   `req.body`, calls `orderService.transition(req, id, status, reason)`,
   wraps the result in `success()`.
5. **`order.service.js`** — opens a transaction, row-locks the order
   (`findByIdForUpdate`), checks the requested move against
   `order.transitions.js`'s table (409 if it's not a legal edge), writes the
   new status + a history row, then runs the side effects for that specific
   edge (e.g. `CONFIRMED` commits the stock reservation via
   `inventory.service.commit()` and updates the customer's spend stats via a
   lazy, try/caught call into `customer.service.applyOrderStats()`).
6. **`order.repository.js`** / **`inventory.repository.js`** — the actual
   Sequelize calls, all inside the same transaction so a failure anywhere
   rolls back stock, order status, and history together.
7. Anything thrown anywhere in that chain is an `ApiError` (or gets
   normalized into one by **`middleware/errorHandler.js`**, which is the only
   place a JSON error body is ever built.

---

## 7. Auth & permissions in one paragraph

`authenticate` puts `{ id, email, roles, permissions }` on `req.user`, read
from the JWT claims (refreshed on every login/refresh so a revoked role
can't ride out an old token — `authorize()` re-resolves permissions from the
database and caches them once per request in `rbac.service.js`, so a role
revoked mid-session takes effect on the very next request, not just the next
login). `authorize('resource:action', ...)` passes if the user holds *any*
listed permission, or holds the implicit `*` from the `admin` role.
`authorizeSelfOr('resource:action')` is the IDOR guard used on
`/users/:id`-shaped routes: the caller can always act on their own id, and
needs the permission otherwise. Every permission string follows
`resource:action` (`orders:update`, `products:create`, ...) and the full
matrix is seeded in `database/seeders/20260101000001-roles-permissions-admin.js`.

---

## 8. Adding a new feature — the checklist

Say you're adding a `reviews` module (phase 13). In order:

1. **Migration** — `src/database/migrations/<timestamp>-create-reviews.js`.
   Copy the shape of an existing one (e.g. `...-create-wishlist.js`); snake_case
   columns, `queryInterface.addIndex`/`addConstraint` for anything the DB
   should enforce (uniqueness, non-negative checks — see how
   `customers`/`addresses` uses partial unique indexes for "one default
   address").
2. **Model** — `src/modules/reviews/review.model.js`. camelCase field names
   (Sequelize + `underscored: true` in `config/database.js` maps them to
   snake_case columns automatically), a `.associate(db)` static if it
   references other models. It's auto-loaded; nothing else to register.
3. **Repository** — `review.repository.js`. Every `db.Review.findX/create/update`
   call for this module lives here and only here.
4. **Service** — `review.service.js`. Business rules ("only a delivered,
   non-returned purchase can be reviewed", "one review per customer per
   variant") and `ApiError` throws live here. If it needs another module's
   data, call that module's *service* (not its repository), and wrap
   optional cross-module calls in the lazy-require + try/catch pattern from
   §3 if the feature shouldn't hard-fail when the other module is absent.
5. **Validation** — `review.validation.js`. One Joi object per route,
   exported by name and consumed via `validate(schema.create)` etc.
6. **Controller** — `review.controller.js`. One function per route, each
   wrapped in `catchAsync`, each starting with its `@openapi` block (§4), each
   calling exactly one service function and returning through
   `success()`/`paginated()`.
7. **Routes** — `review.routes.js`. Wire `authenticate`/`authorize`/`validate`
   + the controller function to a path. No business logic, no docs (they're
   in the controller now).
8. **Register the router** — add one line to `src/modules/index.js`:
   `{ path: '/reviews', router: require('./reviews/review.routes') }`.
9. **Tests** — `tests/review.service.test.js`. `jest.mock()` the repository
   (and any other module's service/repository it calls) the same way every
   existing `*.service.test.js` does, and cover the negative cases, not just
   the happy path.
10. **Run it** — `npm run db:migrate`, restart the server, check
    `http://localhost:4000/docs` for the new paths, exercise them from
    Swagger UI's **Try it out**.

If a table needs "the balance/available/total is always computed, never
stored" (see `inventory`, `wallets`), do not add a column for it — compute it
in the service from the ledger/rows, the way `wallet.service.getBalance()` or
`Inventory.prototype.available()` do. If a mutation can race (two requests
touching the same row), lock it with `lock: transaction.LOCK.UPDATE` in the
repository the way `inventory.repository.findByVariantForUpdate` does — don't
just read-then-write and hope.

---

## 9. Running things day to day

```bash
npm run dev          # nodemon-style auto-restart on file changes
npm test              # jest --runInBand, needs a running Postgres (see README)
npm run db:migrate    # apply any new migration files
npm run db:migrate:undo   # roll back the most recent migration
npm run db:seed       # re-run seeders (roles/permissions/admin/base settings)
npm run lint           # eslint over src/ and tests/
```

When in doubt about *why* something is shaped the way it is, grep for the
comment above it — this codebase leans on inline comments at every
non-obvious decision (why a value is capped, why a lock is taken, why a hook
is wrapped in try/catch) rather than a separate design doc, so the answer is
usually one scroll away from the code in question.
