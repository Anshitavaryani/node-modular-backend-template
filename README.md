# Backend template

A modular Express API for MariaDB/MySQL (Sequelize) with Redis and Docker. It is the starting point for a new
backend. It carries the starter's working features (user and admin accounts, sign-in with OTP, reference
data, FAQ, contact us, Stripe payments) in a layout that grows with the product: the code is grouped by product
(`shared/`, `admin/`, `field/`), and each module owns its routes, services, models and tests.

Read `docs/architecture.md` first. It sets out the module contract and the rules that `npm run lint` checks.

## What is in the box

| Area | Where | Notes |
| --- | --- | --- |
| Config and start-up | `src/core/config`, `index.js` | Validated `.env`, DB and Redis connect with retries |
| HTTP | `src/core/http` | Errors in one shape, CORS, uploads, Redis-backed rate limits |
| Redis | `src/core/redis` | Rate limits, OTP cooldowns, login lockouts, health check |
| Database | `src/core/db` | Migrations with a lock, seeds that load only empty tables |
| Email | `src/integrations/mailer` | SMTP, or `MAIL_TRANSPORT=log` for local work |
| Identity | `src/shared/identity` | Users and admins, sessions, OTP, attachments |
| Reference data | `src/shared/reference` | Countries, states, cities, timezones, categories, departments, roles |
| Content and contact | `src/shared/content`, `src/shared/contact` | FAQ, contact-us submissions |
| Billing | `src/shared/billing` | Payments and the Stripe webhook |
| Admin and field apps | `src/admin`, `src/field` | Empty, ready for the product's own modules |
| Porting notes | `docs/porting-notes.md` | What changed from the starter, and the open items

## Run it with Docker

```bash
cp .env.example .env              # set JWT_SECRET, SUPER_ADMIN_* at least
docker compose up -d --build      # MariaDB, Redis, phpMyAdmin (localhost:8080), API (localhost:5000)
docker compose run --rm api npm run migrate
docker compose run --rm api npm run seed
docker compose run --rm api npm run auth    # the first super admin
curl http://localhost:5000/api/healthcheck  # {"response":"ok", ...}
```

## Run it on your machine

You need Node 22, MariaDB or MySQL 8 and Redis 6 or later (`docker compose up -d mysql redis` starts both).

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
| `npm run dev` | Start with reload on change |
| `npm start` | Start (production: use `NODE_ENV=production` and the ecosystem file with pm2) |
| `npm run migrate` / `migrate:status` / `migrate:down` | Schema changes |
| `npm run seed` | Reference data (only into empty tables) |
| `npm run auth` | Create the super admin from `SUPER_ADMIN_*` |
| `npm test` | Build `app_test` from the migrations and seeds, then run the tests |
| `npm run lint` | oxlint and the module boundary check |

## Starting a project from this template

1. Rename the app in `.env` (`APP_NAME`), set real secrets, and set the role and department IDs to match your seeds.
2. Decide the products and their modules (see `docs/architecture.md`, "Adding a module").
3. Put the project's own tables in migrations, not in edits to existing ones.
4. Keep `npm run lint` and `npm test` green. The boundary check is what keeps the modules separate as the project grows.

## Known limits of the template

- Upload checks trust the declared MIME type and extension (see `docs/architecture.md`, "Uploads").
- Stripe is wired for the starter's flows only. Check the webhook events you need before go-live.
- The admin and field products have no endpoints yet.
