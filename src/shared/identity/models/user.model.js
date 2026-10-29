const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/db/central.db");

class User extends Model {}
User.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      references: {
        model: "roles",
        key: "id",
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripe_customer_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    socket_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    fcm_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Misspelled column name (reffral_id). It is persisted, so it stays until a migration renames it.
    reffral_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("ACCEPTED", "PENDING", "REJECTED", "REVIEWED", "REVIEWING"),
      defaultValue: "PENDING",
    },
    remember_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_proof_verify: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    notification_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: "users",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

// Runs inside the creating transaction when there is one: a save outside it would wait on the row lock that
// transaction holds.
User.afterCreate(async (user, options) => {
  user.socket_id = `${user.role_id}-${user.id}-socketId`;
  user.user_name = await generateUniqueUserName(user.email, user.role_id);
  await user.save({ transaction: options.transaction });
});

// Display name only, not a security token, so Math.random is enough here.
function generateRandomNumber() {
  return Math.floor(10000 + Math.random() * 90000);
}

async function generateUniqueUserName(email, roleId) {
  const base = email.split("@")[0];
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}${generateRandomNumber()}`;
    if (!(await User.isUserNameTaken(candidate, roleId))) {
      return candidate;
    }
  }
  return `${base}${Date.now()}`;
}

User.isEmailTaken = async function (email, role_id) {
  const u = await this.findOne({
    where: { email: email, role_id: role_id, is_active: true },
  });
  return !!u;
};

User.isUserNameTaken = async function (user_name, role_id) {
  const u = await this.findOne({
    where: { user_name: user_name, role_id: role_id, is_active: true },
  });
  return !!u;
};

User.beforeDestroy(async (user) => {
  user.is_active = false;
});

module.exports = User;
