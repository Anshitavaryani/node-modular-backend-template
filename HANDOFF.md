# Handoff: the modular backend template

Paste this file into VS Code's Claude, together with the repo. Claude Code also reads `CLAUDE.md` automatically.

## What this is

A modular backend template for any project (Node.js 24+, Express 5, MariaDB/MySQL with Sequelize, Redis, Docker),
built from the starter `node-starter-2`. It keeps every feature of the starter with the same API paths, in a layout
where each product (`shared`, `admin`, `field`) owns its modules, and each module owns its routes, services, models and
tests. It is generic: a project starts from it, renames it (README, "Starting a project from this template") and adds its
own modules. Keep project names and business rules out of `src/core` and `src/shared`.

Do not remove a starter feature (FAQ, Stripe, the country/state/city/category lookups, seeds) without asking the owner.

## Run it

```bash
cp .env.example .env            # set JWT_SECRET and the SUPER_ADMIN_* values; the role IDs must match the seeds
npm install
npm run migrate && npm run seed && npm run auth
npm run dev                     # needs MariaDB 10.11+ or MySQL 8 and Redis 7+ (or: docker compose up -d mysql redis)
npm test                        # 50 tests; builds app_test and empties Redis DB 15
npm run lint                    # oxlint and the module boundary check
```

Docker: `docker compose up -d --build`, then `docker compose run --rm api npm run migrate` (and `seed`, `auth`). If
another stack holds a port, change `CENTRAL_MYSQL_PORT`, `REDIS_PORT`, `PMA_PORT` or `PORT` in `.env`.

## Done and verified (50 tests pass, lint clean with no warnings, boundaries clean)

- **Versions.** Every npm package is at its latest release. The Docker images are Node 26 LTS, MariaDB 12.3 LTS,
  Redis 8 and phpMyAdmin 5.2. An existing MariaDB 10.11 volume upgrades in place (`MARIADB_AUTO_UPGRADE`). The suite
  passed on MariaDB 10.11 and on 12.3.
- **Docker, run for real.** `up --build`, migrate, seed, `auth` (a second run creates nothing, a weak password is
  refused), `backup`, and the healthcheck: 200 when up, 503 when Redis is stopped, and 200 again when it returns.
- **Every starter route has a test**, against the real database and Redis. Stripe is faked at the SDK; webhook
  signatures use the real library.
- **Parity with the starter**, checked route by route (`docs/porting-notes.md`). Everything the port had lost is
  restored:
  - role tiers on the FAQ, contact-us and payment-total routes;
  - one active account per email, enforced by the database;
  - constraint errors as 400s;
  - uploads loadable from other origins, and the 254-character email cap;
  - the request log, the heartbeat, `npm run backup` and `npm run staging`;
  - the starter's rate-limit rule: 20 failed requests per 15 minutes per IP on every auth path. Code requests are now
    also limited, to 10 per 15 minutes per IP.
- **Stripe.**
  - The SDK's own API version is used (the 2022 pin is gone).
  - Payment methods are automatic unless one is named.
  - Amount and currency are checked before Stripe is called, and OMR uses three decimals.
  - The webhook sets `payment_status`: SUCCESS, REJECTED, or REFUNDED on a full refund. A late event never undoes a
    newer status.
  - Country accounts and `DEFAULT_AMOUNT` are in `config.stripe`.
- **Behaviour the starter got wrong, now fixed:**
  - Creates need their fields, and every new password must meet the rules.
  - Admin code requests do not reveal who is an admin.
  - An admin's tokens end when the password changes, and same-second user tokens are now unique.
  - List pages are capped at `MAX_API_DATA_LIMIT`.
  - Upload errors are 400s, and a failed request's files are deleted.
  - Saving an unchanged FAQ entry no longer answers 404.

## Left to do

1. **`moment`.** The template's code does not use it. It is a dependency of Sequelize 6 (the latest stable), and only
   Sequelize 7 drops it; Sequelize 7 is still alpha (7.0.0-alpha.48). Move when Sequelize 7 is released.
2. **Stripe against a real test account.** Run a payment with a test key and forward webhooks with the Stripe CLI
   (`stripe listen --forward-to localhost:5000/api/v1/payment/stripe/charge-intent/webhooks`).
3. **Uploads.** Types are checked by declared MIME type and extension only. Add content sniffing before files are
   served publicly.
4. **Email.** SMTP has not been tried against a real server (local runs use `MAIL_TRANSPORT=log`). Review the email
   templates' wording before a project uses them.
5. **MySQL 8** has not been run; MariaDB 10.11 and 12.3 have.
6. **Project questions** in `docs/decisions.md`: which roles may self-register, and the contact form's fields.

## Conventions (see CLAUDE.md for the full list)

- Responses via `responseWrapper`, errors via `ApiError`, async handlers wrapped in `catchAsync`.
- Config only from `src/core/config/config.js`. Validate input first: a missing field is a 400.
- Admin routes use `authenticateAdmin` (plus `requireRole` where a tier applies); user routes use `authenticate`.
- Add a module: folder under `src/<product>/`, then `src/modules.js` and `src/models.js`, then a migration for its tables.
- Never edit an applied migration; add a new one.
