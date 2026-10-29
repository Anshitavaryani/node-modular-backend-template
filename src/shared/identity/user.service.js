// Signed-in user's profile, notification setting and account deactivation.
const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const { User, UserAttachment, Profile } = require("../../models");

const getProfile = async (user) => {
  const result = await User.findOne({
    attributes: [
      "id",
      "user_name",
      "email",
      "role_id",
      "stripe_customer_id",
      "socket_id",
      "fcm_token",
      "status",
      "notification_status",
    ],
    include: [
      {
        model: Profile,
        as: "user_profile",
        attributes: ["name", "dialing_code", "mobile", "is_active", "created_at"],
      },
      {
        model: UserAttachment,
        as: "user_attachments",
        attributes: ["id", "title", "file_type", "file_name", "file_uri", "role_id"],
        order: [["id", "desc"]],
        limit: 1,
      },
    ],
    where: { id: user.id, is_active: true, role_id: user.role_id },
  });
  if (!result) throw new ApiError(httpStatus.NOT_FOUND, "Profile not found.");
  return result;
};

const deactivateAccount = async (user) => {
  // Soft delete: destroy() resolves without a value on success, so there is nothing to check.
  await user.destroy();
  return "";
};

const toggleNotification = async (user) => {
  user.notification_status = !user.notification_status;
  await user.save();
  return user;
};

const findUserById = (id) => User.findOne({ where: { id, is_active: true } });

module.exports = { getProfile, deactivateAccount, toggleNotification, findUserById };
