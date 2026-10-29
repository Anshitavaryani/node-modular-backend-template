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

## Open items for the team

These are the starter's own open questions, or gaps found in porting. Each needs a decision before go-live.

1. **Payment status.** No webhook handler updates `payments.payment_status`. Decide which Stripe events change it.
2. **Stripe country keys.** The starter's per-country Stripe keys (`_MY`, `_AU`, `_MX`, `_WECHAT`, `_UK`) and
   `DEFAULT_AMOUNT` are read from `process.env` in `shared/billing`. Move them into `core/config/config.js` once the
   countries they serve are decided.
3. **Role tiers.** The starter checked `isAdmin` and `isEditor` in places. The template protects admin routes with
   `authenticateAdmin` and `requireRole(...abbreviations)`. Each route's roles are listed in the route file.
4. **Self-registration roles.** Only `USR_ROLE_ID` may self-register by default (`SELF_REGISTERABLE_ROLE_IDS` adds
   more). The role IDs are in `.env.example`; they must match the seeded rows.
5. **Public write routes without limits.** `POST /contactUs` and `POST /user/auth/register` have Redis-backed
   limits in production (`authLimiter`), but `POST /contactUs` has none. Add `limiter('contact', ...)` if spam is a
   concern.
6. **Upload content checks.** Upload types are checked by MIME type and extension only (see `architecture.md`).
7. **Starter role `SP_ROLE_ID`** (in the starter README) is not in the template config and was not ported.
8. **Email templates.** The OTP and verification mails use the starter's HTML templates, which still carry the
   starter's wording. Review them before a client sees them.
9. **Log transport.** With `MAIL_TRANSPORT=log` the OTP codes are written to the log. Never use it in production.
