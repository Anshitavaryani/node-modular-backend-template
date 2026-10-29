const { Sequelize, DataTypes, Model } = require("@sequelize/core");
const sequelize = require("../../../core/db/central.db");
const { NumericBigInt } = require("../../../core/db/dataTypes");

class UserToken extends Model {}
UserToken.init(
  {
    id: {
      type: NumericBigInt.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      references: {
        table: "roles",
        key: "id",
      },
    },
    user_id: {
      type: NumericBigInt.UNSIGNED,
      allowNull: false,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      references: {
        table: "users",
        key: "id",
      },
    },
    token_type: {
      type: DataTypes.ENUM("access", "forgot_password", "refresh", "reset_password", "session", "email_varification"),
      defaultValue: "session",
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fcm_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    expired_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
  },
  {
    sequelize,
    tableName: "user_tokens",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

UserToken.hooks.addListener("beforeDestroy", async (userToken) => {
  userToken.is_active = false;
});

module.exports = UserToken;
