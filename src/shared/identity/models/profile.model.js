const { Sequelize, DataTypes, Model } = require("@sequelize/core");
const sequelize = require("../../../core/db/central.db");
const { NumericBigInt } = require("../../../core/db/dataTypes");

class Profile extends Model {}
Profile.init(
  {
    id: {
      type: NumericBigInt.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
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
    email: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    dialing_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    mobile: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "profiles",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

Profile.hooks.addListener("beforeDestroy", async (profile) => {
  profile.is_active = false;
});

module.exports = Profile;
