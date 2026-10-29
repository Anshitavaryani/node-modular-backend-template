# Porting notes: the starter in the modular template

What changed from `node-starter-2` when its features were moved into the modules, and what is still open. Each item
names the file to look at. The API paths are unchanged, except where a row below says otherwise.

## Changes that frontends must make

| Change | Where | Action for the frontend |
| --- | --- | --- |
| The audio upload field is `audios` (was `songs`) | `core/http/uploads.js`, identity register | Send and read `audios`; files are served at `/audios` |
| Auth failures return 401 (were 400 or 404 in places): "Token Not Found", "User Not Found", the admin missing-token case | identity | Treat 401 as "sign in again" |
| Admin tokens are sent in `x-access-token`, and carry a `scope` of `admin` | identity | No change for the sign-in call; a user token is now refused on admin routes |
| Admin sign-in tokens last `ADMIN_TOKEN_HOURS` (default 12) | identity | The starter gave 5 days |
| Login returns the profile name (the starter returned undefined) | identity | None |
| Stripe webhook acknowledgement is `data: { received: true }` | billing | None (Stripe ignores the body) |
| Stripe webhook secret is `STRIPE_WEBHOOK_SECRET` (was `..._INTENT_CHARGE`) | billing, `.env.example` | Set the new name |
| Login's `data.role_id` is a number (the starter echoed the `role_id` header, a string) | identity | Compare as a number |
| A database constraint error answers `"This record already exists."`, `"Invalid data."` or `"A value is too long."`, with the field names in `details` (the starter sent Sequelize's own message; too long was a 500) | `core/http/errorHandler.js` | Read `details` for the field |
| A 429 from the rate limiter has `success: false` and `code: TOO_MANY_REQUESTS` (the starter sent `success: true`) | `core/http/rateLimiter.js` | Check the status, not `success` alone |
| A refused CORS origin is 403 `ORIGIN_NOT_ALLOWED` (was a 500); a Stripe card error is Stripe's 4xx with `code: PAYMENT_FAILED` (was a 500) | `core/http` | None |
| `/api/healthcheck` answers 503 `{ response: "degraded", checks }` when the database or Redis is down (was always 200) | `app.js` | Point load balancers at it |

## Fixes made while porting

- **Admin routes accepted user tokens.** An admin token was verified only by its subject ID, so a user with ID 1
  passed as the super admin. Admin sign-in tokens now carry `scope: admin`, and only those pass. A reset token
  carries `admin_reset` and is refused on admin routes.
- **Role check on admin routes matched display names.** The starter compared `Sub_Admin` with `Sub Admin`, so
  sub-admins were blocked. Checks now use the role abbreviation.
- **Super-admin guard compared role IDs strictly.** A numeric ID slipped past. IDs are now compared as strings.
- **Admin create returned the password hash, OTP and remember token.** It now returns the public fields only.
- **Stripe payment type `"CARD"` was rejected by Stripe.** The default is `"card"`.
- **Stripe signature failures returned 500 when no key was set.** They return 400, and 503 when the webhook secret
  is missing.
- **Admin forgot-password did not check the reset token's expiry.** It does now.
- **Redis was configured but unused.** It now backs rate limits (`rl:` keys), OTP resend cooldowns and sign-in
  lockouts (5 failures in 15 minutes; 5 wrong codes void the code).
- **Admin token and reset token were both signed with the same secret and no purpose.** Each now has its own scope.

Found and fixed after the port, by the tests and the parity check of 2026-10-29:

- **Role tiers had been dropped.** FAQ writes were open to any admin (the starter allowed the editor tier: super admin,
  admin, sub-admin, engineer, editor), and the contact-us list, edit and delete and the payment totals were open to any
  admin (the starter allowed super admin, admin and sub-admin). Each route file now names its tier again.
- **One active account per email was not enforced by the database.** Two simultaneous registrations made two accounts.
  Migration `20261029-1200-unique-active-emails.js` adds the unique keys the starter's migrations meant to add (theirs
  could not run: MariaDB and MySQL refuse a stored generated column on `role_id`, which cascades on update).
- **Database constraint errors were 500s.** A duplicate, a model validation failure and a value longer than its column
  are 400s (the starter mapped the first two).
- **Uploaded files could not be loaded from another origin.** Helmet's default `Cross-Origin-Resource-Policy:
  same-origin` is replaced by `cross-origin`, as in the starter.
- **Emails over 254 characters were accepted.** The starter's cap is back in `core/utils/validateEmail.js`.
- **User tokens made in the same second were identical**, so a logout or a password change could leave the other
  session working. Tokens carry a random `jti`.
- **`POST /admin/auth/otp` without an email was a 500** (also in the starter). It is a 400.
- **Saving a FAQ entry unchanged gave 404** (also in the starter: a bulk update counts no changed rows). The row is
  found first.
- **The rate limiter's 429 had no `data` field.** It has `data: ""`, as every error does.

## Open items for the team

These are the starter's own open questions, or gaps found in porting. Each needs a decision before go-live.

1. **Payment status.** Done: the webhook sets `payments.payment_status` from `payment_intent.succeeded` (SUCCESS),
   `payment_intent.payment_failed` and `payment_intent.canceled` (REJECTED) and a full `charge.refunded` (REFUNDED). A
   late or repeated event never undoes a newer status. A project that needs other statuses extends `STATUS_EVENTS` in
   `shared/billing/payment.service.js`.
2. **Stripe country keys.** Done: they and `DEFAULT_AMOUNT` are in `config.stripe`. A country with no keys uses the main
   account. Each user has one stored Stripe customer, so a project that really uses several accounts should store one
   customer per account.
3. **Role tiers.** The starter's `isAdmin` and `isEditor` checks are `requireRole(...abbreviations)` in the template,
   with the tier named in each route file (FAQ writes: editor tier; contact-us admin routes, payment totals and
   departments: admin tier; roles: super admin). Projects with other roles adjust those lists.
4. **Self-registration roles.** Only `USR_ROLE_ID` may self-register by default (`SELF_REGISTERABLE_ROLE_IDS` adds
   more). The role IDs are in `.env.example`; they must match the seeded rows (now only Super Admin 1 and User 2).
5. **Rate limits.** In production, as in the starter, every `/user/auth/*` and `/admin/auth/*` path allows 20 failed
   requests per 15 minutes per IP (successful ones are not counted). Added: the two `/otp` routes allow 10 requests per
   15 minutes per IP, successful or not, and `POST /contactUs` 10 per hour.
6. **Upload content checks.** Upload types are checked by MIME type and extension only (see `architecture.md`).
7. **Starter role `SP_ROLE_ID`** (in the starter README) is not in the template config and was not ported.
8. **Email templates.** The OTP and verification mails use the starter's HTML templates, which still carry the
   starter's wording. Review them before a client sees them.
9. **Log transport.** With `MAIL_TRANSPORT=log` the OTP codes are written to the log. Never use it in production.

## Parity check against the starter (2026-10-29)

Checked against commit `55ad540` (2026-08-18) of https://github.com/Mohit-211/node-starter-2: routes, controllers,
services, middleware, models, migrations and `app.js`. All 45 starter routes exist in the template with the same method
and path. The starter as published cannot start: `src/services/User/auth.service.js` requires
`../../utils/randomStringGenerate`, and the file is `randomStringGenrate.js`. So its behaviour here is what its code
says, not what a running server returned.

### The starter's README "Known issues / Open items"

| Starter item | In the template |
| --- | --- |
| `roles.sql` and `departments.sql` hold example data | Closed: the seed has only the Super Admin and User roles and the Admin department; projects create the rest from the admin panel. |
| `SP_ROLE_ID` in config with no meaning | Closed: not ported (unused). |
| `.sequelizerc` may be missing, so `npm run migrate` fails | Closed: the template runs its own migrations (`src/core/db/migrate.js`), not `sequelize-cli`. |
| `role.middleware.js` reads `req.user.role_id`, not cross-checked with `findRoleById` | Closed: `requireRole` reads the role of the current admin row and matches its abbreviation; tested for every tier. |
| No admin session revocation (no admin token table) | Open: an admin token still lives until it expires (12 h, was 5 days), even after a password change or reset. |
| `package.json` `name` is a product name | Closed: it is `node-modular-backend-template`; the README tells each project to rename it. |

### Starter features outside the routes

| Starter feature | In the template |
| --- | --- |
| Unique active email (migrations `20260817120000`, `...0001`) | Restored (see the fixes above). |
| Constraint errors as 400 (`utils/errorHandler.js`) | Restored. |
| Helmet `crossOriginResourcePolicy: cross-origin` | Restored. |
| `validateEmail` 254-character cap | Restored. |
| HTTP request log (`morgan`; success and error lines, off in tests) | Restored without morgan (`core/http/requestLogger.js`): IP, method, URL, status, time, and the error message on failures. |
| Heartbeat log line every minute (`node-cron` in `app.js`) | Restored as a job in `src/jobs.js` (off with `JOBS_ENABLED=false`). |
| `src/config/db_backup.js`: `mysqldump`, gzip, 14-day retention in `db_backups/` (no npm script ran it) | Restored as `npm run backup` (`scripts/db-backup.js`), into `STORAGE_DIR/backups`; the API image has `mariadb-dump`. |
| `npm run staging` with `ecosystem.staging-config.json` (pm2) | Restored, with `npm run start:pm2`; `npm start` stays `node index.js` (Docker runs that). |
| `npm run sync` (create or alter tables from the models) | Replaced on purpose by migrations. |
| socket.io middleware (`middlewares/socketiomw.js`) | Not ported: the starter never created a socket server, so it did nothing. `users.socket_id` is kept. |
| `/songs` static folder | Renamed `/audios` (see the frontend table). |

### Decided on 2026-10-29

1. **Rate limiting:** back to the starter's rule (see open item 5), with a limit on code requests added.
2. **Starter features not carried over:** all restored (table above).
3. **The CORS `credentials` middleware:** removed, as the starter had; `cors()` sets the headers.
4. **Register uploads:** multer's errors are 400 (413 for a file too large), and the files of a request that fails are
   deleted. Content sniffing is still open (open item 6).
5. **`GET /test`:** removed.
6. **The behaviours the starter shared:**
   - FAQ, role and department creates need their fields.
   - Every new password must meet the rules.
   - `POST /admin/auth/otp` answers the same for any email, and wrong admin codes and reset tokens are 400s.
   - An admin's token ends when their password changes.
   - Contact update checks the email.
   - `reset-password` no longer returns token IDs.
   - `?limit=` is capped at `MAX_API_DATA_LIMIT` (1000).
   - Admin responses have messages.
