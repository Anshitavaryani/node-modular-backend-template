const { Sequelize, DataTypes, Model } = require("@sequelize/core");
const sequelize = require("../../../core/db/central.db");
const { NumericBigInt } = require("../../../core/db/dataTypes");

class OTP extends Model {}
OTP.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      references: {
        table: "roles",
        key: "id",
      },
    },
    user_id: {
      type: NumericBigInt.UNSIGNED,
      allowNull: true,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      references: {
        table: "users",
        key: "id",
      },
    },
    dialing_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    mobile: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    // Values are persisted; 'varification' is misspelled on purpose (see constants.js).
    type: {
      type: DataTypes.ENUM("email_varification", "mobile_varification", "forgot_password", "reset_password"),
      allowNull: false,
      defaultValue: "email_varification",
    },
    otp_expiration_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "otps",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

// Every OTP lives five minutes from its last validation (creation or save).
OTP.hooks.addListener("beforeValidate", async (otp) => {
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + 5);
  otp.otp_expiration_time = expirationTime;
});

OTP.hooks.addListener("beforeDestroy", async (otp) => {
  otp.is_active = false;
});

module.exports = OTP;
