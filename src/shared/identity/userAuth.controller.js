const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const catchAsync = require("../../core/http/catchAsync");
const pick = require("../../core/utils/pick");
const responseWrapper = require("../../core/http/responseWrapper");
const userAuth = require("./userAuth.service");

const sendOTP = catchAsync(async (req, res) => {
  const response = await userAuth.sendOTP(pick(req.body, ["email", "type"]), req.headers.role_id);
  return responseWrapper(res, response, "OTP has been Sent To Your Email");
});

const verifyOTP = catchAsync(async (req, res) => {
  const status = await userAuth.verifyOTP(
    req.body.email,
    req.body.otp,
    req.body.type,
    req.headers.role_id
  );
  if (!status) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Unable to verify OTP — the associated account may no longer exist."
    );
  }
  return responseWrapper(
    res,
    status,
    "OTP has been verified. Please Create Your Profile.",
    httpStatus.OK
  );
});

const register = catchAsync(async (req, res) => {
  const body = pick(req.body, ["name", "email", "mobile", "password"]);
  const response = await userAuth.register(body, req.files, req.headers.role_id);
  return responseWrapper(
    res,
    response,
    "User Created Successfully. Please Check Your Email to verify Your Account.",
    httpStatus.CREATED
  );
});

const login = catchAsync(async (req, res) => {
  const response = await userAuth.login(pick(req.body, ["email", "password"]), {
    roleId: req.headers.role_id,
    timezone: req.headers.timezone,
    ip: req.ip,
  });
  return responseWrapper(res, response, "Successfully Logged in.");
});

// The new password's strength is checked by auth.validateResetPasswordBody.
const resetPassword = catchAsync(async (req, res) => {
  const response = await userAuth.resetPassword(
    { user: req.user, tokenDoc: req.tokenDoc },
    req.body
  );
  return responseWrapper(res, response, "Password changed Successfully.");
});

const forgotPassword = catchAsync(async (req, res) => {
  const response = await userAuth.forgotPassword(req.passwordReset, req.body);
  return responseWrapper(res, response, "Password changed Successfully.");
});

const logout = catchAsync(async (req, res) => {
  const response = await userAuth.logout(req.tokenDoc, req.headers.timezone);
  return responseWrapper(res, response, "Successfully Logged out.");
});

module.exports = { sendOTP, verifyOTP, register, login, resetPassword, forgotPassword, logout };
