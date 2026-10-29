const { Sequelize, DataTypes, Model } = require("@sequelize/core");
const sequelize = require("../../../core/db/central.db");
const { NumericBigInt } = require("../../../core/db/dataTypes");

class Admin extends Model {}
Admin.init(
  {
    id: {
      type: NumericBigInt.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
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
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      references: {
        table: "departments",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    socket_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    remember_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Admin OTP state lives on the admin row (not the otps table). Setting a code marks it valid.
    otp: {
      type: DataTypes.STRING,
      allowNull: true,
      set(value) {
        this.setDataValue("is_otp_valid", !!value);
        this.setDataValue("otp", value);
      },
    },
    is_otp_valid: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: "admins",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

// Saves inside the creating transaction, if any (see the User model).
Admin.hooks.addListener("afterCreate", async (admin, options) => {
  admin.socket_id = `${admin.role_id}-${admin.id}-${admin.department_id}-socketId`;
  await admin.save({ transaction: options.transaction });
});

// Admin emails are unique across the whole admin hierarchy, so the check is by email only.
Admin.isEmailTaken = async function (email) {
  const u = await this.findOne({ where: { email: email, is_active: true } });
  return !!u;
};

Admin.hooks.addListener("beforeDestroy", async (admin) => {
  admin.is_active = false;
});

module.exports = Admin;
