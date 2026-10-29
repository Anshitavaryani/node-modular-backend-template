// The identity module's tables. Each model file imports only core, so enum values are written out in them.
const User = require("./user.model");
const Profile = require("./profile.model");
const UserToken = require("./userToken.model");
const UserAttachment = require("./userAttachment.model");
const OTP = require("./otp.model");
const UserLoginTiming = require("./userLoginTiming.model");
const Admin = require("./admin.model");

// Associations this module owns: the FK-holding side, plus its own parent-child links. Called by src/models.js once
// every module's models are loaded, with all of them by name.
const associate = ({ Role, Department }) => {
  User.belongsTo(Role, { foreignKey: "role_id", as: "user_role" });

  Admin.belongsTo(Role, { foreignKey: "role_id", as: "admin_role" });
  Admin.belongsTo(Department, { foreignKey: "department_id", as: "admin_department" });

  User.hasOne(Profile, { foreignKey: "user_id", as: "user_profile" });
  Profile.belongsTo(User, { foreignKey: "user_id", as: "profile_user" });

  User.hasMany(UserAttachment, { foreignKey: "user_id", as: "user_attachments" });
  UserAttachment.belongsTo(User, { foreignKey: "user_id", as: "attachments_user" });

  User.hasMany(UserToken, { foreignKey: "user_id", as: "user_tokens" });
  UserToken.belongsTo(User, { foreignKey: "user_id", as: "token_user" });
};

module.exports = {
  models: { User, Profile, UserToken, UserAttachment, OTP, UserLoginTiming, Admin },
  associate,
};
