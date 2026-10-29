// User sign-in, registration and one-time codes.
const bcrypt = require("bcryptjs");
const sequelize = require("../../core/db/central.db");
const ApiError = require("../../core/http/ApiError");
const httpStatus = require("../../core/http/status");
const logger = require("../../core/logger");
const validateEmail = require("../../core/utils/validateEmail");
const randomDigits = require("../../core/utils/randomDigits");
const mailer = require("../../integrations/mailer");
const { User, Profile, OTP, UserAttachment } = require("../../models");
const { USER_STATUS, OTP_TYPES, LIMITS, REGISTER_UPLOADS } = require("./constants");
const { generateAuthTokens, randomToken } = require("./token.service");
const { saveLoginTiming, saveLogoutTiming } = require("./loginTiming");
const lockout = require("./lockout");

// User codes are four digits (the admin side uses six).
const OTP_CODE_LENGTH = 4;
const TOO_MANY_CODES = "Too many incorrect codes. Please request a new code.";
const TOO_MANY_LOGINS = "Too many failed sign-in attempts. Please try again later.";

const normalise = (email) => String(email).trim().toLowerCase();
const otpKeys = (email) => ({
  cooldown: `otp:cooldown:${normalise(email)}`,
  failures: `otp:failures:${normalise(email)}`,
});
const hashPassword = (password) => bcrypt.hash(password, 10);
const passwordMatches = (plain, hash) => (hash ? bcrypt.compare(plain, hash) : false);

const sendOTP = async ({ email, type }, roleId) => {
  if (!validateEmail(email) || !Object.values(OTP_TYPES).includes(type)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email or Type.");
  }
  const keys = otpKeys(email);
  await lockout.assertCooldown(keys.cooldown);

  const existing = await OTP.findOne({ where: { email, type, role_id: roleId } });
  if (existing) await existing.destroy({ force: true });

  const code = randomDigits(OTP_CODE_LENGTH);
  await OTP.create({ email, code, type, role_id: roleId });

  if (type === OTP_TYPES.FORGOT_PASSWORD) {
    await mailer.sendForgotPasswordOTP(email, code);
  } else if (type === OTP_TYPES.EMAIL_VERIFICATION) {
    await mailer.sendEmailVerification(email, code);
  }
  await lockout.clearFailures(keys.failures);
  await lockout.startCooldown(keys.cooldown, LIMITS.OTP_RESEND_COOLDOWN_SECONDS);
  return true;
};

// Returns { token } for a verified forgot-password code, otherwise whether the account was activated.
const verifyOTP = async (email, otp, type, roleId) => {
  if (!email || !otp || !type || !roleId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Please Enter Required Fields : [email, otp, type, role_id]"
    );
  }
  const keys = otpKeys(email);
  await lockout.assertNotLocked(keys.failures, LIMITS.OTP_MAX_WRONG_ATTEMPTS, TOO_MANY_CODES);

  const otpDoc = await OTP.findOne({
    where: { email, type, is_active: true, is_verified: false, role_id: roleId },
  });
  if (!otpDoc) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email or Type");

  if (String(otp) !== otpDoc.code) {
    const failures = await lockout.recordFailure(
      keys.failures,
      LIMITS.OTP_WRONG_ATTEMPT_WINDOW_SECONDS
    );
    if (failures >= LIMITS.OTP_MAX_WRONG_ATTEMPTS) {
      // The code is spent once too many guesses have been made; a new one must be requested.
      await OTP.update({ is_active: false }, { where: { id: otpDoc.id } });
      throw lockout.tooManyRequests(TOO_MANY_CODES);
    }
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP Entered");
  }

  if (otpDoc.otp_expiration_time < new Date()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "OTP has been Expired");
  }
  await lockout.clearFailures(keys.failures);

  otpDoc.is_active = false;
  otpDoc.is_verified = true;
  let isUpdate = false;
  let token = "";
  if (type !== OTP_TYPES.FORGOT_PASSWORD) {
    // Scoped by role_id: one role's account is verified, not every account that shares the email.
    const [affectedCount] = await User.update(
      { status: USER_STATUS.ACCEPTED },
      { where: { email, role_id: roleId, is_active: true } }
    );
    isUpdate = affectedCount > 0;
  } else {
    token = randomToken(50);
    otpDoc.code = token;
  }
  await otpDoc.save();
  return token ? { token } : isUpdate;
};

const register = async ({ name, email, mobile, password }, files, roleId) => {
  const code = randomDigits(OTP_CODE_LENGTH);

  await sequelize.transaction(async (transaction) => {
    const user = await User.create(
      { email, password: await hashPassword(password), role_id: roleId },
      { transaction }
    );
    await Profile.create({ email, name, mobile, user_id: user.id }, { transaction });
    await OTP.destroy({
      where: { email, type: OTP_TYPES.EMAIL_VERIFICATION, role_id: roleId },
      force: true,
      transaction,
    });
    await OTP.create(
      {
        user_id: user.id,
        email,
        code,
        type: OTP_TYPES.EMAIL_VERIFICATION,
        role_id: roleId,
      },
      { transaction }
    );
    for (const [field, fileType] of Object.entries(REGISTER_UPLOADS)) {
      for (const file of files?.[field] ?? []) {
        await UserAttachment.create(
          {
            role_id: roleId,
            user_id: user.id,
            title: "Profile Image",
            file_type: fileType,
            file_name: file.filename,
            file_uri: `/${field}`,
            file_size: String(file.size),
          },
          { transaction }
        );
      }
    }
  });

  // Sent after commit, so a stored account never waits on the mail server.
  await mailer.sendEmailVerification(email, code);
  const keys = otpKeys(email);
  await lockout.clearFailures(keys.failures);
  await lockout.startCooldown(keys.cooldown, LIMITS.OTP_RESEND_COOLDOWN_SECONDS);
  return {};
};

const login = async ({ email, password }, { roleId, timezone, ip }) => {
  const failKey = `login:failures:${normalise(email)}`;
  await lockout.assertNotLocked(failKey, LIMITS.LOGIN_MAX_FAILURES, TOO_MANY_LOGINS);

  const user = await User.findOne({
    where: { email, is_active: true, status: USER_STATUS.ACCEPTED, role_id: roleId },
    include: [{ model: Profile, as: "user_profile", attributes: ["name"] }],
  });
  if (!user) {
    await lockout.recordFailure(failKey, LIMITS.LOGIN_WINDOW_SECONDS);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Error: Customer not found. Please verify otp First"
    );
  }
  if (!(await passwordMatches(password, user.password))) {
    await lockout.recordFailure(failKey, LIMITS.LOGIN_WINDOW_SECONDS);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Error: Invalid email or password. Please try again."
    );
  }
  await lockout.clearFailures(failKey);

  const tokens = await generateAuthTokens(user);
  try {
    await saveLoginTiming(user, tokens, ip, timezone);
  } catch (error) {
    logger.warn(`saveLoginTiming failed for user ${user.id}: ${error.message}`);
  }
  delete tokens.access.id;
  delete tokens.refresh.id;
  return {
    id: user.id,
    name: user.user_profile?.name,
    email: user.email,
    tokens,
    role_id: user.role_id,
  };
};

const resetPassword = async ({ user, tokenDoc }, { old_password, confirm_password }) => {
  if (!(await passwordMatches(old_password, user.password))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect Old Password.");
  }
  user.password = await hashPassword(confirm_password);
  await user.save();

  await tokenDoc.destroy({ force: true });
  const tokens = await generateAuthTokens(user);
  return { tokens };
};

const forgotPassword = async ({ user, otpDoc }, { password, confirm_password }) => {
  if (password !== confirm_password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "New Password and Confirm Password Must Be Equal"
    );
  }
  user.password = await hashPassword(confirm_password);
  await user.save();
  await otpDoc.destroy({ force: true });
  return "";
};

const logout = async (tokenDoc, timezone) => {
  try {
    await saveLogoutTiming(tokenDoc, timezone);
  } catch (error) {
    logger.warn(`saveLogoutTiming failed for token ${tokenDoc.id}: ${error.message}`);
  }
  await tokenDoc.destroy();
  return "";
};

module.exports = {
  sendOTP,
  verifyOTP,
  register,
  login,
  resetPassword,
  forgotPassword,
  logout,
};
