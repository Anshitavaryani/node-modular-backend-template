// Admin accounts: sign-in, password change, and the OTP-based password reset.
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../../core/config/config");
const ApiError = require("../../core/http/ApiError");
const httpStatus = require("../../core/http/status");
const randomDigits = require("../../core/utils/randomDigits");
const mailer = require("../../integrations/mailer");
const { Admin } = require("../../models");
const { OTP_TYPES, LIMITS } = require("./constants");
const lockout = require("./lockout");

const TOO_MANY_CODES = "Too many incorrect codes. Please request a new code.";
const TOO_MANY_LOGINS = "Too many failed sign-in attempts. Please try again later.";

const normalise = (email) => String(email).trim().toLowerCase();
const adminOtpKeys = (email) => ({
  cooldown: `admin:otp:cooldown:${normalise(email)}`,
  failures: `admin:otp:failures:${normalise(email)}`,
});
const hashPassword = (password) => bcrypt.hash(password, 10);
const passwordMatches = (plain, hash) => (hash ? bcrypt.compare(plain, hash) : false);

// The admin record without its credentials and reset state.
const toPublicAdmin = (admin) => {
  const { password, otp, remember_token, ...rest } = admin.get({ plain: true });
  return rest;
};

// scope tells an admin sign-in token apart from a user token (both carry the same kind of sub) and from a reset token.
const signAdminToken = (admin, expiresIn, scope = "admin") =>
  jwt.sign(
    { sub: admin.id, role_id: admin.role_id, department_id: admin.department_id, scope },
    config.jwt.secret,
    { algorithm: "HS256", expiresIn }
  );

const isUnexpiredToken = (token) => {
  try {
    jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
};

const createAdminUser = async ({ name, email, password, role_id, department_id }) => {
  const admin = await Admin.create({
    name,
    email,
    password: await hashPassword(password),
    role_id,
    department_id,
  });
  return toPublicAdmin(admin);
};

const loginAdminUser = async ({ email, password }) => {
  const failKey = `admin:login:failures:${normalise(email)}`;
  await lockout.assertNotLocked(failKey, LIMITS.LOGIN_MAX_FAILURES, TOO_MANY_LOGINS);

  const admin = await Admin.findOne({ where: { email, is_active: true } });
  if (!admin) {
    await lockout.recordFailure(failKey, LIMITS.LOGIN_WINDOW_SECONDS);
    throw new ApiError(httpStatus.BAD_REQUEST, "Error: User not found.");
  }
  if (!(await passwordMatches(password, admin.password))) {
    await lockout.recordFailure(failKey, LIMITS.LOGIN_WINDOW_SECONDS);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Error: Invalid email or password. Please try again."
    );
  }
  await lockout.clearFailures(failKey);

  return {
    name: admin.name,
    email: admin.email,
    token: signAdminToken(admin, `${config.jwt.adminTokenHours}h`),
  };
};

const resetAdminPassword = async (admin, { old_password, confirm_password }) => {
  if (!(await passwordMatches(old_password, admin.password))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect Old Password.");
  }
  admin.password = await hashPassword(confirm_password);
  await admin.save();
  return "Password Changed Successfully.";
};

const sendOTP = async (email) => {
  const admin = await Admin.findOne({ where: { email, is_active: true } });
  if (!admin) throw new ApiError(httpStatus.NOT_FOUND, "Invalid Email");

  const keys = adminOtpKeys(email);
  await lockout.assertCooldown(keys.cooldown);

  const code = randomDigits(6);
  await mailer.sendForgotPasswordOTP(email, code);
  await Admin.update({ otp: code, is_otp_valid: true }, { where: { id: admin.id } });
  await lockout.clearFailures(keys.failures);
  await lockout.startCooldown(keys.cooldown, LIMITS.OTP_RESEND_COOLDOWN_SECONDS);
  return true;
};

// Returns { token } for a forgot-password code, otherwise "".
const verifyOTP = async (email, otp, otpType) => {
  if (!email || !otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please Enter Required Fields : [email, otp]");
  }
  const keys = adminOtpKeys(email);
  await lockout.assertNotLocked(keys.failures, LIMITS.OTP_MAX_WRONG_ATTEMPTS, TOO_MANY_CODES);

  const admin = await Admin.findOne({ where: { email } });
  if (!admin) throw new ApiError(httpStatus.NOT_FOUND, "Invalid Email");

  if (String(otp) !== admin.otp || admin.is_otp_valid === false) {
    const failures = await lockout.recordFailure(
      keys.failures,
      LIMITS.OTP_WRONG_ATTEMPT_WINDOW_SECONDS
    );
    if (failures >= LIMITS.OTP_MAX_WRONG_ATTEMPTS) {
      admin.is_otp_valid = false;
      await admin.save();
      throw lockout.tooManyRequests(TOO_MANY_CODES);
    }
    throw new ApiError(httpStatus.NOT_FOUND, "Invalid OTP Entered");
  }

  // Expiry uses updated_at, which the write of the code bumps; the admin row has no expiration column.
  const otpAgeMs = Date.now() - new Date(admin.updated_at).getTime();
  if (otpAgeMs > LIMITS.ADMIN_OTP_VALIDITY_MS) {
    throw new ApiError(httpStatus.BAD_REQUEST, "OTP has expired. Please request a new one.");
  }
  await lockout.clearFailures(keys.failures);

  let token = "";
  if (otpType === OTP_TYPES.FORGOT_PASSWORD) {
    token = signAdminToken(admin, LIMITS.ADMIN_RESET_TOKEN_EXPIRES_IN, "admin_reset");
    admin.remember_token = token;
  }
  admin.is_otp_valid = false;
  await admin.save();
  return token ? { token } : "";
};

const forgotAdminPassword = async ({ email, password, confirm_password, token }) => {
  if (!email || !password || !confirm_password || !token) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Please Enter Required Fields : [ email, password, confirm_password, token ]"
    );
  }
  const admin = await Admin.findOne({
    where: { email, remember_token: token, is_active: true },
  });
  if (!admin || !isUnexpiredToken(token)) {
    throw new ApiError(httpStatus.NOT_FOUND, "Invalid Email or Token");
  }
  if (password !== confirm_password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "New Password and Confirm Password Must Be Equal"
    );
  }
  admin.password = await hashPassword(confirm_password);
  admin.remember_token = null;
  await admin.save();
  return "Password Changed Successfully.";
};

module.exports = {
  createAdminUser,
  loginAdminUser,
  resetAdminPassword,
  sendOTP,
  verifyOTP,
  forgotAdminPassword,
};
