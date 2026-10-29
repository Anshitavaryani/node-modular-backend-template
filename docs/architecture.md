# Backend layout

The code is grouped by product. Each product has its own folder; what more than one product uses lives in `shared/`.

```
src/
  core/          config, db (connection, migrations, seeds, baseline schema), http (errors, CORS, uploads, responses,
                 rate limits), redis (the shared client and its connection), logger, utils
  integrations/  external services: mailer (SMTP or log transport, email templates)
  shared/        used by every product:
                   identity   user and admin accounts: registration, one-time codes, sign-in, tokens, profile
                   reference  roles, departments (admin APIs), countries, states, cities (public reads), timezones
                   content    FAQ
                   contact    contact-us messages
                   billing    payments and Stripe (signed webhook)
  admin/         endpoints for an admin app (empty in the template; see admin/README.md)
  field/         endpoints for a client app (empty in the template; see field/README.md)
  models.js      loads every module's models, then their associations
  modules.js     every module, in mount order
  routes.js      mounts each module's routes under /api/v1
  jobs.js        starts the heartbeat and the cron jobs modules declare (unless JOBS_ENABLED=false)
```

Top level: `app.js` (the Express app: middleware, health check, routes, errors), `index.js` (starts the server, the
database, Redis and the jobs), `scripts/` (the boundary check, the super-admin script, the database backup), `test/`
(the test suite), `vendor/` (third-party code installed from the repo: `dottie`, which Sequelize 7 needs and npm marks
unsupported; see `vendor/README.md`).

## A module

A module is a folder `<product>/<module>/` containing:

- `*.route.js`, `*.controller.js`, `*.service.js`, and `*.validation.js` when it validates input;
- `models/`: its tables, one file per model, and `models/index.js`, which exports `{ models, associate }`. `associate`
  defines the associations the module owns (the side with the foreign key);
- `index.js`, the module's public face:

```js
module.exports = {
    routes: () => [{ path: '/user/auth/', router: require('./userAuth.route') }], // mounted under /api/v1
    jobs: () => [],                                                              // optional, started by src/jobs.js
    authenticate,                                                                // what other modules may call
};
```

Other modules reach a module only through its `index.js`. Models come from `require('<...>/models')` (`src/models.js`).

## Adding a module

1. Create `src/<product>/<module>/` with `models/`, the route, controller and service files, and `index.js`.
2. Add it to `src/modules.js` (routes) and to `src/models.js` (models), in the order it needs.
3. Add a migration in `src/core/db/migrations/` for any new table or column (see Migrations).
4. Run `npm run lint` (boundaries and style), `npm test`, and `npm run dev`.

## Rules (`npm run lint` checks them)

- `core` imports nothing above it; `integrations` import only `core`.
- A product never imports another product; `shared` never imports a product (so admin and field can use shared,
  but shared cannot use admin).
- A module reaches another module only through its `index.js`.
- Code uses (and associates with) only its own product's and shared models.
- Known exceptions, with reasons, are listed in `scripts/boundary-exceptions.js`. Remove an entry when its code is
  fixed; the check fails while a fixed entry stays.

## Configuration

`src/core/config/config.js` reads `.env` (through `process.loadEnvFile`) and checks it at start-up. A missing required
variable stops the process with a message that names it. Empty values count as unset. See `.env.example` for every
variable and what it does.

The database is reached through Sequelize 7. `CENTRAL_DB_DIALECT` picks the dialect: `mariadb` (the default, with the
`mariadb` driver) or `mysql` (MySQL 8, with `mysql2`). `core/db/options.js` holds the connection options that the app's
pool and the migration runner share; `core/db/dataTypes.js` holds `NumericBigInt`, the BIGINT type that keeps ids as
numbers.

## Authentication

- **Users** sign in with a token sent in the `x-access-token` header. Each token is a signed JWT and a row in
  `user_tokens`, so logout revokes it.
- **Admins** have their own token with `scope: admin`. Only that scope passes `authenticateAdmin`; a user token or a
  password-reset token is refused. Admin tokens are not stored; each carries a stamp of the admin's password, so a
  password change or reset ends every earlier session.
- Routes state their protection in the route file: public, `authenticate` (user), `authenticateAdmin` (admin), or
  `requireRole(...)` for role tiers.

## Redis

Redis is required. The app will not start without it. It is used for:

- **Rate limits**: `core/http/rateLimiter.js`. Counters are shared by every process and survive a restart.
  Limits apply in production only: every `/user/auth` and `/admin/auth` path allows 20 failed requests per 15 minutes
  per IP, the `/otp` routes 10 requests per 15 minutes, and `POST /contactUs` 10 per hour.
- **Short-lived keys**: one-time-code resend cooldowns and sign-in lockouts, written by the modules with the client in
  `core/redis/redis.js`. Keys get the prefix `REDIS_KEY_PREFIX` (default: the app name), so one Redis server can serve
  several apps. Tests use Redis database 15.
- **Health**: `GET /api/healthcheck` returns 200 only when the database and Redis both answer, otherwise 503.

Start-up connects to Redis and the database with retries (for slow containers) and exits if they stay unreachable.

## Database, migrations and seeds

- Schema changes are migrations in `src/core/db/migrations/`, named `YYYYMMDD-HHMM-<what>.js`, run in name order.
  Each exports `up` and `down`. The runner records what it applied in `schema_migrations`, and it takes a lock so
  two deploys cannot run at once. Commands: `npm run migrate`, `npm run migrate:status`, `npm run migrate:down`.
- MariaDB and MySQL commit schema changes immediately, so write each migration to be safe to run again after a fix.
- The baseline migration (`20261029-0000-baseline.js`) loads `schema/baseline.sql`, the schema the models define when
  the template was made. A new database is built by migrating from empty; an existing one only records the migration.
- Reference data is in `src/core/db/seeds/*.sql` (roles, departments, timezones). `npm run seed` loads each table only
  while it is empty, so running it again changes nothing.

## Uploads

`core/http/uploads.js` writes files under `STORAGE_DIR/uploads/<field>` (outside the repo by default) and serves them
at `/<field>`. It accepts images, GIF, MP4/MOV, PDF, MP3, DOC and DOCX up to 25 MB. The check uses the declared MIME
type and extension, which a client can fake. Anything served publicly needs content sniffing before it is trusted.
Multer's own errors are 400s (413 for a file too large), and the files of a request that fails are deleted.

## Logs and backups

- Every request is logged (outside tests) with the client IP, method, URL, status and time; a failure adds its error
  message (`core/http/requestLogger.js`). A heartbeat line is logged every minute while jobs are on.
- `npm run backup` writes a gzipped dump to `STORAGE_DIR/backups` and deletes files older than
  `BACKUP_RETENTION_DAYS` (14). Run it from cron on the server, or `docker compose run --rm api npm run backup`.

## Tests

`npm test` builds an `app_test` database (or `TEST_DATABASE`) from the migrations and seeds, empties Redis database 15
(`TEST_REDIS_DB`), then runs every `test/*.test.js` file in turn. The test database name must end in `_test`, or
the setup refuses to run.

## Checks

| Command | Proves |
| --- | --- |
| `npm run lint` | style (oxlint) and the module rules |
| `npm run check:boundaries` | the module rules only |
| `npm test` | the test suite, on a database built from the migrations and seeds |
