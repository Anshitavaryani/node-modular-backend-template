# Backend template

A modular Express API for MariaDB/MySQL (Sequelize) with Redis and Docker. It is the modular version of the starter
(`node-starter-2`), with every feature kept: user and admin accounts, roles and departments, countries, states,
cities, FAQ, contact us and Stripe payments. Code is grouped by product (`shared/`, `admin/`, `field/`), and each module
owns its routes, services, models and tests.

Read `CLAUDE.md` first: it is the reference for the layout, the module rules, every route and the conventions.
`docs/architecture.md` covers the layout in more depth, `docs/decisions.md` and `docs/porting-notes.md` record what
changed from the starter, and `HANDOFF.md` lists what is done and what is left.

Versions: Node.js 24 or later (the Docker image uses Node 26 LTS), Express 5, Sequelize 6, MariaDB 12.3 LTS (or MySQL 8),
Redis 8, Stripe SDK 23.

## What is in the box

| Area | Where |
| --- | --- |
| Config and start-up | `src/core/config`, `index.js` |
| HTTP (errors, CORS, uploads, rate limits) | `src/core/http` |
| Redis (rate limits, cooldowns, lockouts, health) | `src/core/redis` |
| Database (migrations with a lock, seeds, baseline schema) | `src/core/db` |
| Email (SMTP, or log for local work) | `src/integrations/mailer` |
| User and admin accounts | `src/shared/identity` |
| Roles, departments, countries, states, cities, timezones | `src/shared/reference` |
| FAQ | `src/shared/content` |
| Contact-us messages | `src/shared/contact` |
| Payments (Stripe) | `src/shared/billing` |
| Admin and client app endpoints (empty) | `src/admin`, `src/field` |

## Run it with Docker

```bash
cp .env.example .env              # set JWT_SECRET and SUPER_ADMIN_* at least
docker compose up -d --build      # MariaDB 12.3, Redis 8, phpMyAdmin (localhost:8080), API (localhost:5000)
docker compose run --rm api npm run migrate
docker compose run --rm api npm run seed
docker compose run --rm api npm run auth    # the first super admin
curl http://localhost:5000/api/healthcheck  # {"response":"ok", ...}
```

If another stack already uses a port, set `CENTRAL_MYSQL_PORT`, `REDIS_PORT`, `PMA_PORT` or `PORT` in `.env`: compose
publishes on those, and the API and tests on your machine connect to the same values.

`npm test` creates `app_test`. On a new data volume, `docker/mariadb-init/test-databases.sh` gives the app user rights on
`*_test` databases. On a volume created before that script, grant them once:

```bash
docker compose exec mysql sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON \`%\\_test\`.* TO \"$MARIADB_USER\"@\"%\""'
```

## Run it on your machine

You need Node 24 or later, MariaDB 10.11 or later (or MySQL 8), and Redis 7 or later (`docker compose up -d mysql redis`
starts the two services).

```bash
cp .env.example .env              # CENTRAL_MYSQL_HOST and REDIS_HOST default to localhost
npm install
npm run migrate
npm run seed
npm run auth
npm run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | start with reload on change |
| `npm start` | start |
| `npm run migrate` / `migrate:status` / `migrate:down` | schema changes |
| `npm run seed` | reference data (only into empty tables) |
| `npm run auth` | create the first super admin |
| `npm run backup` | gzipped database dump into `STORAGE_DIR/backups`, keeping 14 days (needs `mariadb-dump`; the Docker image has it: `docker compose run --rm api npm run backup`) |
| `npm run start:pm2` / `npm run staging` | start under pm2 (install it globally) with `ecosystem.config.json` / `ecosystem.staging-config.json` |
| `npm test` | build `app_test` from the migrations and seeds, then run the tests |
| `npm run lint` | oxlint and the module boundary check |

## Payments (Stripe)

Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` and, for the webhook, `STRIPE_WEBHOOK_SECRET`. The SDK's own Stripe API
version is used. Point a Stripe webhook endpoint at `POST /api/v1/payment/stripe/charge-intent/webhooks` with these events:
`payment_intent.succeeded` (payment becomes `SUCCESS`), `payment_intent.payment_failed` and `payment_intent.canceled`
(`REJECTED`), and `charge.refunded` (`REFUNDED` when fully refunded). A payment intent with no `paymentMethod` lets
Stripe offer the methods switched on in its dashboard.

## Starting a project from this template

1. Rename the app in `.env` (`APP_NAME`), `package.json`, `ecosystem.config.json` and `ecosystem.staging-config.json`,
   and set real secrets (`JWT_SECRET`, `SUPER_ADMIN_PASSWORD`, Stripe keys).
2. Set the role and department IDs in `.env` to match the seeded rows.
3. Add the project's products and modules (see `CLAUDE.md`, "Layout and module rules").
4. Put the project's tables in migrations. Never edit an applied migration.
5. Keep `npm run lint` and `npm test` green.
