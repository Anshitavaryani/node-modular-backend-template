// Values the identity module's services and routes share. Model files write their own enum values, because models
// may import only core.

const USER_STATUS = {
  ACCEPTED: "ACCEPTED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  REVIEWING: "REVIEWING",
  REVIEWED: "REVIEWED",
};

// Persisted in otps.type and sent by clients. The 'varification' spelling is kept: changing it needs a data backfill.
const OTP_TYPES = {
  EMAIL_VERIFICATION: "email_varification",
  MOBILE_VERIFICATION: "mobile_varification",
  FORGOT_PASSWORD: "forgot_password",
  RESET_PASSWORD: "reset_password",
};

// Role abbreviations, as seeded in roles (src/core/db/seeds/roles.sql). requireRole() compares against these.
const ROLE = {
  SUPER_ADMIN: "SUP_ADM",
  ADMIN: "ADM",
  SUB_ADMIN: "SUB_ADM",
  ENGINEER: "ENG",
  EDITOR: "EDTR",
  USER: "USR",
};

const TOKEN_TYPE = { ACCESS: "access" };

const ACCESS_TOKEN_HEADER = "x-access-token";

const LIMITS = {
  LOGIN_MAX_FAILURES: 5,
  LOGIN_WINDOW_SECONDS: 15 * 60,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  OTP_MAX_WRONG_ATTEMPTS: 5,
  OTP_WRONG_ATTEMPT_WINDOW_SECONDS: 15 * 60,
  // Admin codes are valid for 5 minutes from the last write to the admin row (see adminAuth.service.js).
  ADMIN_OTP_VALIDITY_MS: 5 * 60 * 1000,
  ADMIN_RESET_TOKEN_EXPIRES_IN: "1d",
};

// Registration upload fields: form field -> file_type stored on the attachment.
const REGISTER_UPLOADS = {
  images: "Image",
  gifs: "Gif",
  videos: "Video",
  docs: "Document",
  audios: "Audio",
};

module.exports = {
  USER_STATUS,
  OTP_TYPES,
  ROLE,
  TOKEN_TYPE,
  ACCESS_TOKEN_HEADER,
  LIMITS,
  REGISTER_UPLOADS,
};
