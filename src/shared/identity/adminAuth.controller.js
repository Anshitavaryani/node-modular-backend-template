const catchAsync = require("../../core/http/catchAsync");
const responseWrapper = require("../../core/http/responseWrapper");
const httpStatus = require("../../core/http/status");
const pick = require("../../core/utils/pick");
const adminAuth = require("./adminAuth.service");

const createAdminUser = catchAsync(async (req, res) => {
  const admin = await adminAuth.createAdminUser(req.body);
  return responseWrapper(res, admin, "Admin Created Successfully.", httpStatus.CREATED);
});

const loginAdminUser = catchAsync(async (req, res) => {
  const response = await adminAuth.loginAdminUser(pick(req.body, ["email", "password"]));
  return responseWrapper(res, response, "Successfully Logged in.", httpStatus.OK);
});

const resetAdminPassword = catchAsync(async (req, res) => {
  const response = await adminAuth.resetAdminPassword(req.admin, req.body);
  return responseWrapper(res, response, "Password Changed Successfully. Please sign in again.", httpStatus.OK);
});

const sendOTP = catchAsync(async (req, res) => {
  await adminAuth.sendOTP(req.body.email);
  return responseWrapper(res, "", "OTP has been Sent To Your Email", httpStatus.OK);
});

const verifyOTP = catchAsync(async (req, res) => {
  const status = await adminAuth.verifyOTP(req.body.email, req.body.otp, req.body.otp_type);
  return responseWrapper(res, status, "OTP has been verified", httpStatus.OK);
});

const forgotAdminPassword = catchAsync(async (req, res) => {
  const response = await adminAuth.forgotAdminPassword(req.body);
  return responseWrapper(res, response, "Password Changed Successfully.", httpStatus.OK);
});

module.exports = {
  createAdminUser,
  loginAdminUser,
  resetAdminPassword,
  sendOTP,
  verifyOTP,
  forgotAdminPassword,
};
