const { Sequelize, DataTypes, Model } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('../../../core/db/central.db');

class Category extends Model {}

Category.init({
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
}, {
    sequelize,
    tableName: 'categories',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
});

// The slug is derived from the title on every validation.
Category.beforeValidate((category) => {
    if (category.title) category.slug = slugify(category.title, { lower: true });
});

Category.beforeDestroy((category) => {
    category.is_active = false;
});

module.exports = Category;
