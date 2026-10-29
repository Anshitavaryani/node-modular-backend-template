const { Sequelize, DataTypes, Model } = require("@sequelize/core");
const sequelize = require("../../../core/db/central.db");
const { NumericBigInt } = require("../../../core/db/dataTypes");

class UserAttachment extends Model {}
UserAttachment.init(
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
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_uri: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_size: {
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
    tableName: "user_attachments",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

UserAttachment.hooks.addListener("beforeDestroy", async (userAttachment) => {
  userAttachment.is_active = false;
});

module.exports = UserAttachment;
