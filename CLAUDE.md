# Reference for this repo (read first)

This repo is a **modular backend template** for any project that uses **Node.js 24+ (Docker: Node 26 LTS), Express 5,
MariaDB/MySQL (Sequelize 7), Redis and Docker**. It is the modular version of `node-starter-2` (the starter), with all the starter's
features kept, and it is the starting point for new projects. Nothing in it belongs to one product: keep project names,
products and business rules out of `src/core/` and `src/shared/`. A project adds its own modules under `src/admin/`,
`src/field/` or new product folders, and keeps `src/core/` as it is. `HANDOFF.md` lists what is done and what is left.

## What the template contains

| Module | What it does |
| --- | --- |
| `src/shared/identity` | Users: registration with an email code, sign-in, logout, profile, notifications, deactivation. Admins: created by a super admin, sign-in, change password, password reset by code. Owns the auth middleware (`authenticate`, `authenticateAdmin`, `requireRole`). |
| `src/shared/reference` | Roles (super admin), departments (admin roles), countries, states, cities (public reads), and timezones and roles/departments as tables. |
| `src/shared/content` | FAQ: public read; admin writes. |
| `src/shared/contact` | Contact-us: anyone can send one (rate limited in production); only an admin reads or changes the list. |
| `src/shared/billing` | Stripe: a user gets the publishable key and creates payment intents; a signed webhook updates `payments.payment_status`; admin totals. |
| `src/admin`, `src/field` | Empty placeholders for an admin app's and a client app's own endpoints. |

## Routes (all under `/api/v1`)

| Method | Path | Protection |
| --- | --- | --- |
| POST | `/user/auth/otp` | none; sends a code, 60 s cooldown per email, 10 per 15 min per IP in production |
| POST | `/user/auth/verify-otp` | none; rate limited |
| POST | `/user/auth/register` | none; rate limited; `role_id` header must be self-registerable |
| POST | `/user/auth/login` | none; rate limited; lockout after 5 wrong passwords in 15 min |
| POST | `/user/auth/reset-password` | user token |
| POST | `/user/auth/forgot-password` | none; needs the verified code |
| GET | `/user/auth/logout` | user token |
| GET | `/user/profile` | user token |
| POST | `/user/notifications` | user token |
| DELETE | `/user/deactivate` | user token |
| POST | `/admin/auth/register` | admin token, super admin only |
| POST | `/admin/auth/login` | none; rate limited |
| POST | `/admin/auth/change-password` | admin token |
| POST | `/admin/auth/otp`, `/verify-otp`, `/forgot-password` | none; the recovery flow (`/otp` answers the same for any email) |
| POST, GET | `/role/` | super admin token (create, list); `GET, PUT, DELETE /role/:id` likewise |
| POST, GET | `/department/` | admin token; `GET, PUT, DELETE /department/:id` likewise |
| GET | `/country/`, `/country/:id`, `/state/`, `/state/:id`, `/city/`, `/city/:id` | none (public reads) |
| GET | `/faq/` | none |
| POST, PUT, DELETE | `/faq/`, `/faq/:id` | admin token, editor tier (super admin, admin, sub-admin, engineer, editor) |
| POST | `/contactUs/` | none; rate limited in production |
| GET, PUT, DELETE | `/contactUs/`, `/contactUs/:id` | admin token, admin tier (super admin, admin, sub-admin) |
| GET | `/payment/stripe/stripe-key` | user token |
| POST | `/payment/stripe/create-payment-intent` | user token |
| POST | `/payment/stripe/charge-intent/webhooks` | none; Stripe signature checked against the raw body |
| GET | `/payment/count`, `/payment/sum` | admin token, admin tier |
| GET | `/api/healthcheck` | none; 200 only when the database and Redis both answer |

In production every `/user/auth/*` and `/admin/auth/*` path is rate limited per IP: 20 failed requests per 15 minutes
(successful ones are not counted). Limits are off in development and tests.

## How requests and responses look

- Success: `{ "success": true, "status": 200, "message": "...", "data": ... }`.
- Error: `{ "success": false, "status": 4xx, "message": "...", "data": "" }`, with an optional `code` and `details`.
  Errors are thrown as `ApiError` (`src/core/http/ApiError.js`) and formatted by `errorHandler`. A database constraint
  (duplicate, model validation, value too long) is a 400 with the field names in `details`. A body that is not valid
  JSON is a 400, one over 1 MB a 413. Anything else is logged and returned as a generic 500.
- Tokens: send `x-access-token: <token>`. A user gets it from `POST /user/auth/login` in `data.tokens.access.token`; an
  admin from `POST /admin/auth/login` in `data.token`. An admin token carries `scope: admin`; a user token is refused on
  admin routes. An admin token stops working when that admin's password changes; a user's password change ends that
  session and returns a new token.
- Passwords: at least 8 characters, 2 digits, no spaces (`src/shared/identity/passwordRules.js`), checked wherever a
  password is set.
- Self-registration role: the `role_id` **header**, never the body. Only roles in `SELF_REGISTERABLE_ROLE_IDS` are
  accepted; a missing header means `USR_ROLE_ID`.
- Seeded roles (`src/core/db/seeds/roles.sql`): 1 Super Admin (`SUP_ADM`), 2 Admin (`ADM`), 3 Sub_Admin, 4 Engineer,
  5 Editor, 6 User (`USR`). Departments: 1 IT, 2 Admin, 3 Maintenance, 4 Sales. Set the IDs in `.env`.

## Layout and module rules

```
src/core/        config, db (migrations, seeds, baseline schema), http, redis, logger, utils. Imports nothing above it.
src/integrations/ external services (mailer). Imports only core.
src/shared/      identity, reference, content, contact, billing. Used by every product. Never imports admin/ or field/.
src/admin/       admin-app endpoints (placeholder)
src/field/       client-app endpoints (placeholder)
src/models.js    loads every module's models and associations
src/modules.js   the modules, in mount order
src/routes.js    mounts each module's routes under /api/v1
src/jobs.js      cron jobs that modules declare (JOBS_ENABLED=false turns them off)
app.js, index.js the Express app and the entrypoint
vendor/          third-party code kept in the repo, installed through package.json (see vendor/README.md)
```

A module is `src/<product>/<module>/` with `*.route.js`, `*.controller.js`, `*.service.js`, `models/` (one file per
table, plus `models/index.js` exporting `{ models, associate }`), and `index.js`:

```js
module.exports = {
    routes: () => [{ path: '/thing/', router: require('./thing.route') }], // mounted under /api/v1
    jobs: () => [],                                                       // optional
    someService,                                                          // what other modules may call
};
```

Rules, checked by `npm run lint`: a module reaches another module only through its `index.js`; a product never imports
another product; `shared` never imports a product; models come from `require('<...>/models')`. Exceptions go in
`scripts/boundary-exceptions.js` with a reason, and must be removed when fixed.

To add a module: create the folder, add it to `src/modules.js` and `src/models.js`, add a migration for its tables, then
run `npm run lint` and `npm test`.

## Database

- MariaDB 12.3 LTS (the Docker image; 10.11 works) or MySQL 8 (set `CENTRAL_DB_DIALECT=mysql`), utf8mb4. Dates are
  stored and read in UTC.
- Sequelize 7 (`@sequelize/core` with `@sequelize/mariadb` or `@sequelize/mysql`). It is still alpha, so the version is
  pinned exactly; read its release notes before moving it. Connection options are in `src/core/db/options.js`.
- Models, Sequelize 7 style: BIGINT ids and the columns that point at them use `NumericBigInt`
  (`src/core/db/dataTypes.js`), so ids stay numbers in responses; hooks are `Model.hooks.addListener('beforeDestroy',
  fn)`; a foreign key column has `references: { table: 'users', key: 'id' }`; enum values go in `DataTypes.ENUM([...])`;
  a database error's driver error is `err.cause`. Raw `sequelize.query` results give BIGINT values (such as `COUNT(*)`)
  as strings.
- Schema changes are **migrations** in `src/core/db/migrations/` (`YYYYMMDD-HHMM-name.js`, exporting `up` and `down`).
  Never edit an applied migration; add a new one. `npm run migrate`, `migrate:status`, `migrate:down`.
- The baseline migration loads `src/core/db/schema/baseline.sql` into an empty database. Existing databases only
  record it.
- Reference data: `npm run seed` loads roles, departments, countries, states, cities, categories and timezones, only into
  empty tables.

## Redis

Required; the app will not start without it. Used for: rate limits (keys `rl:...`), one-time-code cooldowns, sign-in
lockouts, and the health check. Keys get the prefix `REDIS_KEY_PREFIX` (default: the app name). Tests use Redis
database **15**, which the test setup empties; never point tests at another database.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | start with reload (needs MariaDB and Redis running; `.env` from `.env.example`) |
| `npm start` | start (production uses `NODE_ENV=production`) |
| `npm run migrate` / `migrate:status` / `migrate:down` | schema |
| `npm run seed` | reference data |
| `npm run auth` | create the first super admin from `SUPER_ADMIN_*` (the password must meet the password rules) |
| `npm run backup` | gzipped dump of the database into `STORAGE_DIR/backups`, keeping `BACKUP_RETENTION_DAYS` days |
| `npm run start:pm2` / `staging` | start under pm2 (installed globally) with `ecosystem.config.json` / `ecosystem.staging-config.json` |
| `npm test` | build `app_test` from migrations and seeds, empty Redis DB 15, run every `test/*.test.js` |
| `npm run lint` | oxlint and the module boundary check |

Docker: `docker compose up -d --build` starts MariaDB, Redis, phpMyAdmin and the API. Then
`docker compose run --rm api npm run migrate`, `... npm run seed`, `... npm run auth`.

## Environment (see `.env.example`)

Required: `APP_NAME`, `NODE_ENV`, `CENTRAL_MYSQL_HOST`, `CENTRAL_MYSQL_USER`, `CENTRAL_MYSQL_DB`, `JWT_SECRET` (32+
characters in production), `USR_ROLE_ID`. Also used: `CENTRAL_DB_DIALECT` (`mariadb` or `mysql`), `CENTRAL_MYSQL_PASSWORD`, `CENTRAL_MYSQL_PORT`, `REDIS_HOST`,
`REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`,
`ADMIN_TOKEN_HOURS`, `SELF_REGISTERABLE_ROLE_IDS`, `ACCESSDOMAINS` (CORS origins), `MAIL_TRANSPORT` (`smtp` or `log`),
`SMTP_*`, `EMAIL_FROM`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DEFAULT_AMOUNT`,
`STRIPE_*_MY|AU|MX|WECHAT|UK` (country accounts), `SUPER_ADMIN_*`, `ADM_DEPT_ID`, `JOBS_ENABLED`, `STORAGE_DIR`,
`DEFAULT_API_DATA_LIMIT`, `MAX_API_DATA_LIMIT`, `BACKUP_RETENTION_DAYS`, `PMA_PORT` (compose only).

## Conventions when you change code

- Keep `src/core` generic: no project names, no product rules.
- Responses go through `responseWrapper`; errors through `ApiError`; async handlers are wrapped in `catchAsync`.
- Config is read from `src/core/config/config.js`, never from `process.env` in modules.
- Validate input before the database. A missing field must give 400, not 500.
- Protect admin routes with `authenticateAdmin` (and `requireRole` for a tier); user routes with `authenticate`. A route
  with no protection is a deliberate choice, and its route file says so.
- Tests live in `test/<module>.test.js` and run against real MariaDB and Redis.
- Do not commit `.env` (git-ignored) or `node_modules`. Do not remove a starter feature without asking the owner.

## Known open items

See `HANDOFF.md` for the current list, and `docs/decisions.md` for the decisions behind the port.
