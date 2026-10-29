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
npm test                        # 52 tests; builds app_test and empties Redis DB 15
npm run lint                    # oxlint and the module boundary check
```

Docker: `docker compose up -d --build`, then `docker compose run --rm api npm run migrate` (and `seed`, `auth`). If
another stack holds a port, change `CENTRAL_MYSQL_PORT`, `REDIS_PORT`, `PMA_PORT` or `PORT` in `.env`.

## Done and verified (52 tests pass, lint clean with no warnings, boundaries clean)

- **Versions.** Every npm package is at its latest release. The Docker images are Node 26 LTS, MariaDB 12.3 LTS,
  Redis 8 and phpMyAdmin 5.2. An existing MariaDB 10.11 volume upgrades in place (`MARIADB_AUTO_UPGRADE`).
- **Sequelize 7, no `moment`.** The ORM is Sequelize 7 (`@sequelize/core` 7.0.0-alpha.48, pinned), which uses `dayjs`;
  `moment` and `moment-timezone` are gone from the dependency tree and the Docker image. MariaDB uses its own dialect,
  MySQL 8 its own (`CENTRAL_DB_DIALECT=mysql`). The API is unchanged: ids are still numbers (`NumericBigInt`), and
  Sequelize 7's new type checks are off, as in the starter. The suite passed on MariaDB 12.3, MariaDB 10.11 and
  MySQL 8.4. `npm install` prints no deprecation warnings: `dottie`, which Sequelize 7 needs and npm marks unsupported,
  is kept unchanged in `vendor/dottie` and installed from there.
- **Login times in the user's zone** (`user_login_timings.login_time_local`) were stored as UTC on a server whose own
  time zone is not UTC (Sequelize 6 did the same). They are now stored as the user's wall-clock time on any server.
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
  - A body that is not valid JSON is a 400 (one over 1 MB a 413), not a 500.
  - Saving an unchanged FAQ entry no longer answers 404.

## Left to do

1. **Sequelize 7 is alpha.** It is pinned at 7.0.0-alpha.48. When a newer 7.x comes out (or the stable 7.0), read its
   release notes, move `@sequelize/core`, `@sequelize/mariadb` and `@sequelize/mysql` together, and run the suite.
   If it no longer requires `dottie` (`npm ls dottie`), remove `vendor/dottie` and its `overrides` entry.
2. **Stripe against a real test account.** Run a payment with a test key and forward webhooks with the Stripe CLI
   (`stripe listen --forward-to localhost:5000/api/v1/payment/stripe/charge-intent/webhooks`).
3. **Uploads.** Types are checked by declared MIME type and extension only. Add content sniffing before files are
   served publicly.
4. **Email.** SMTP has not been tried against a real server (local runs use `MAIL_TRANSPORT=log`). Review the email
   templates' wording before a project uses them.
5. **Project questions** in `docs/decisions.md`: which roles may self-register, and the contact form's fields.

## Conventions (see CLAUDE.md for the full list)

- Responses via `responseWrapper`, errors via `ApiError`, async handlers wrapped in `catchAsync`.
- Config only from `src/core/config/config.js`. Validate input first: a missing field is a 400.
- Admin routes use `authenticateAdmin` (plus `requireRole` where a tier applies); user routes use `authenticate`.
- Add a module: folder under `src/<product>/`, then `src/modules.js` and `src/models.js`, then a migration for its tables.
- Never edit an applied migration; add a new one.
