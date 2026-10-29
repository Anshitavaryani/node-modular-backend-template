const catchAsync = require("../../core/http/catchAsync");
const responseWrapper = require("../../core/http/responseWrapper");
const userService = require("./user.service");

const getProfile = catchAsync(async (req, res) => {
  const response = await userService.getProfile(req.user);
  return responseWrapper(res, response, "");
});

const deactivateAccount = catchAsync(async (req, res) => {
  const response = await userService.deactivateAccount(req.user);
  return responseWrapper(res, response, "Account Successfully Deactivated.");
});

const toggleNotification = catchAsync(async (req, res) => {
  const updated = await userService.toggleNotification(req.user);
  const message =
    updated.notification_status === true ? "Notification turned On!" : "Notification turned Off!";
  return responseWrapper(res, "", message);
});

module.exports = { getProfile, deactivateAccount, toggleNotification };
