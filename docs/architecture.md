# Backend layout

The code is grouped by product. Each product has its own folder; what more than one product uses lives in `shared/`.
The template ships with two products:

```
src/
  core/          config, db (connection, migrations, seeds), http (errors, CORS, uploads, responses, rate limits),
                 redis (the shared Redis client), logger, utils
  integrations/  external services: mailer (SMTP or log transport, email templates)
  shared/        used by every product:
                   identity   user and admin accounts, sign-in, tokens, OTP, user attachments
                   reference  countries, states, cities, timezones, categories, departments, roles
                   content    FAQ
                   contact    contact-us submissions
                   billing    payments and Stripe
  admin/         the web admin app (empty in the template; see admin/README.md)
  field/         the field technician app (empty in the template; see field/README.md)
  models.js      loads every module's models, then their associations
  modules.js     every module, in mount order
  routes.js      mounts each module's routes under /api/v1
  jobs.js        starts the cron jobs modules declare (unless JOBS_ENABLED=false)
```

Top level: `app.js` (the Express app: middleware, health check, routes, errors), `index.js` (starts the server, the
database, Redis and the jobs), `scripts/` (the boundary check, the super-admin script), `test/` (the test suite).

## A module

A module is a folder `<product>/<module>/` containing:

- `*.route.js`, `*.controller.js`, `*.service.js`, and `*.validation.js` when it validates input;
- `models/`: its tables, one file per model, and `models/index.js`, which exports `{ models, associate }`. `associate`
  defines the associations the module owns (the side with the foreign key);
- `index.js`, the module's public face:

```js
module.exports = {
    routes: () => [{ path: '/user/auth', router: require('./auth.route') }], // mounted under /api/v1 by src/routes.js
    jobs: () => [],                                                          // optional, started by src/jobs.js
    authenticate,                                                            // what other modules may call
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

## Redis

Redis is required. The app will not start without it. It is used for:

- **Rate limits**: `core/http/rateLimiter.js`. Counters are shared by every process and survive a restart.
  Limits apply in production only.
- **Short-lived keys**: one-time-code resend cooldowns and login lockouts, written by the modules with the client in
  `core/redis/redis.js`. Keys get the prefix `REDIS_KEY_PREFIX` (default: the app name), so one Redis server can serve
  several apps.
- **Health**: `GET /api/healthcheck` returns 200 only when the database and Redis both answer, otherwise 503.

Start-up connects to Redis and the database with retries (for slow containers) and exits if they stay unreachable.

## Database, migrations and seeds

- Schema changes are migrations in `src/core/db/migrations/`, named `YYYYMMDD-HHMM-<what>.js`, run in name order.
  Each exports `up` and `down`. The runner records what it applied in `schema_migrations`, and it takes a lock so
  two deploys cannot run at once. Commands: `npm run migrate`, `npm run migrate:status`, `npm run migrate:down`.
- MariaDB and MySQL commit schema changes immediately, so write each migration to be safe to run again after a fix.
- Reference data is in `src/core/db/seeds/*.sql` (roles, departments, countries, states, cities, categories,
  timezones). `npm run seed` loads each table only while it is empty, so running it again changes nothing.
- The baseline migration (`20260101-0000-baseline.js`) creates the tables as they were when the template was made, so
  a new database is built by migrating from empty.

## Uploads

`core/http/uploads.js` writes files under `STORAGE_DIR/uploads/<field>` (outside the repo by default). It accepts
images, GIF, MP4/MOV, PDF, MP3, DOC and DOCX up to 25 MB. The check uses the declared MIME type and extension, which a
client can fake. Anything served publicly needs content sniffing before it is trusted.

## Tests

`npm test` builds a `app_test` database (or `TEST_DATABASE`) from the migrations and seeds, empties Redis database 15 (`TEST_REDIS_DB`), then runs every
`test/**/*.test.js` file in turn. The test database name must end in `_test`, or the setup refuses to run.

## Checks

| Command | Proves |
| --- | --- |
| `npm run lint` | style (oxlint) and the module rules |
| `npm run check:boundaries` | the module rules only |
| `npm test` | the test suite, on a database built from the migrations and seeds |
