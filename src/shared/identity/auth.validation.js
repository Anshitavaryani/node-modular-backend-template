// Request checks for the user auth routes, and the reset-password check shared with the admin side.
const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const catchAsync = require("../../core/http/catchAsync");
const validateEmail = require("../../core/utils/validateEmail");
const config = require("../../core/config/config");
const { User, OTP } = require("../../models");
const { OTP_TYPES } = require("./constants");
const validatePassword = require("./passwordRules");

const badRequest = (message) => new ApiError(httpStatus.BAD_REQUEST, message);

// A request with no role header uses the user role.
const setRoleIdIfNotPresent = (req, res, next) => {
  if (!req.headers.role_id) req.headers.role_id = config.USR_ROLE_ID;
  next();
};

const validateRegisterBody = catchAsync(async (req, res, next) => {
  const { name, email, mobile, password, confirm_password } = req.body;
  const roleId = req.headers.role_id;

  if (!name || !email || !mobile || !password || !confirm_password) {
    throw badRequest(
      "Please Enter Required Fields : [ name || email || mobile || password || confirm_password ]"
    );
  }
  // The role comes from the header, never the body, and only self-registerable roles are accepted.
  if (!config.SELF_REGISTERABLE_ROLE_IDS.includes(String(roleId))) {
    throw badRequest("Invalid role for self-registration.");
  }
  if (!validateEmail(email)) throw badRequest("Invalid Name or Email");
  if (await User.isEmailTaken(email, roleId)) throw badRequest("Email already taken");

  if (!validatePassword(password)) {
    throw badRequest(
      "Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space"
    );
  }
  if (password !== confirm_password) {
    throw badRequest("Password and Confirm Password must be equal.");
  }
  next();
});

const validateSignInBody = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw badRequest("Please Enter Required Fields : [email, password]");
  }
  next();
});

const validateResetPasswordBody = catchAsync(async (req, res, next) => {
  const { old_password, new_password, confirm_password } = req.body;
  if (!old_password || !new_password || !confirm_password) {
    throw badRequest(
      "Please Enter Required Fields : [ old_password || new_password || confirm_password ]"
    );
  }
  if (new_password !== confirm_password) {
    throw badRequest("New Password and Confirm Password Must Be Equal");
  }
  next();
});

// Checks the forgot-password request against the account and the verified OTP token. Sets req.passwordReset.
const validateForgotPasswordRequest = catchAsync(async (req, res, next) => {
  const { email, password, confirm_password, token } = req.body;
  const roleId = req.headers.role_id;

  if (!email || !password || !confirm_password || !token) {
    throw badRequest(
      "Please Enter Required Fields : [ email || new_password || confirm_password || token ]"
    );
  }
  const user = await User.findOne({ where: { email, is_active: true, role_id: roleId } });
  if (!user) throw badRequest("User With This Email Id Not Found.");

  const otpDoc = await OTP.findOne({
    where: {
      email,
      code: token,
      is_verified: true,
      type: OTP_TYPES.FORGOT_PASSWORD,
      role_id: roleId,
    },
  });
  if (!otpDoc) throw badRequest("Forget Password Token is not Valid.");

  req.passwordReset = { user, otpDoc };
  next();
});

module.exports = {
  setRoleIdIfNotPresent,
  validateRegisterBody,
  validateSignInBody,
  validateResetPasswordBody,
  validateForgotPasswordRequest,
};
