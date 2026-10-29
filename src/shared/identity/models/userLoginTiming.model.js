const { Sequelize, DataTypes, Model } = require("@sequelize/core");
const sequelize = require("../../../core/db/central.db");
const { NumericBigInt } = require("../../../core/db/dataTypes");

class UserLoginTiming extends Model {}
UserLoginTiming.init(
  {
    id: {
      type: NumericBigInt.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      onDelete: "CASCADE",
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
    login_time_utc: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    logout_time_utc: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    login_time_local: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    logout_time_local: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    token_id: {
      type: NumericBigInt.UNSIGNED,
      allowNull: true,
      onDelete: "SET NULL",
      references: {
        table: "user_tokens",
        key: "id",
      },
    },
    // Foreign key to timezones.id. The name does not follow the *_id convention; it is persisted, so it stays.
    time_zone: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        table: "timezones",
        key: "id",
      },
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true,
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
  },
  {
    sequelize,
    tableName: "user_login_timings",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

UserLoginTiming.hooks.addListener("beforeDestroy", async (loginTiming) => {
  loginTiming.is_active = false;
});

module.exports = UserLoginTiming;
