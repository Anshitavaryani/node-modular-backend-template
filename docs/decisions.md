# Port decisions

The template is the starter (`node-starter-2`) moved into the modular layout. Every starter feature is kept, with the
same API paths. This file records the decisions and fixes made on the way. `CLAUDE.md` is the reference for working in
the repo, and `HANDOFF.md` lists what is left.

## Kept

Every feature of the starter: user and admin accounts (registration, code-based sign-in, password reset), roles,
departments, countries, states, cities, categories, timezones, FAQ, contact us and Stripe payments. Reference data is
seeded from the starter's SQL dumps.

## Added for the template

- **Redis** is required and backs rate limits, one-time-code cooldowns, sign-in lockouts, and the health check.
- **Docker Compose** runs MariaDB, Redis, phpMyAdmin and the API.
- **Module layout and rules** (`src/shared`, `src/admin`, `src/field`), checked by `npm run lint`.
- **Tests** on a real database and Redis (`npm test`).
- **Stripe** payment status from the webhook (outcomes and full refunds), country accounts and `DEFAULT_AMOUNT` in
  config, the SDK's own API version.
- **Sequelize 7** (7.0.0-alpha.48, pinned exactly) instead of Sequelize 6, to drop `moment`, which only Sequelize 6
  needed. It is still alpha: the owner chose it over waiting for the stable release. MariaDB and MySQL each get their
  own dialect (`CENTRAL_DB_DIALECT`). Two Sequelize 7 defaults are turned back to the starter's behaviour, so the API
  does not change: BIGINT ids are numbers, not strings (`NumericBigInt`), and values are not type-checked against
  their columns (`noTypeValidation`); requests are validated before the database instead.
- **`dottie` vendored.** Sequelize 7 requires `dottie`, and npm marks every published version "no longer supported", so
  installing printed a deprecation warning. Version 2.0.7 is kept unchanged in `vendor/dottie` (MIT) and installed from
  there (`overrides` in `package.json`). Remove it when Sequelize stops requiring it.

## Fixed while porting

- Admin routes accepted a user token, because an admin token was checked only by its subject ID. Admin sign-in tokens
  now carry `scope: admin`; a user token or a reset token is refused.
- Role checks on admin routes compared display names (sub-admins were blocked). They now use the role abbreviation.
- Admin account creation returned the password hash, the one-time code and the remember token. It returns public fields.
- Stripe signature failures returned 500. A bad signature is 400; a missing webhook secret is 503.
- Stripe payment type `"CARD"` was rejected by Stripe; the default is `"card"`.
- Admin forgot-password did not check the reset token's expiry. It does now.
- Contact us: a malformed email is refused with a 400 (the starter stored it; a missing one was already a 400), and the
  public submit is rate limited.
- Redis was configured but unused by the starter; it now backs the limits and lockouts.

## Open decisions (for the project owner)

- Which roles may self-register (`SELF_REGISTERABLE_ROLE_IDS`).
- Whether the contact form keeps the starter's fields (email, address, mobile) or gains a name and message.
- Upload policy: checks use the declared type and extension; add content sniffing before serving user files publicly.
- Email templates carry the starter's wording and should be reviewed before use.
