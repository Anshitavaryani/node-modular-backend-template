const { Sequelize, DataTypes, Model } = require('@sequelize/core');
const sequelize = require('../../../core/db/central.db');
const { NumericBigInt } = require('../../../core/db/dataTypes');
const config = require('../../../core/config/config');

class Payment extends Model {}
Payment.init(
    {
        id: {
            type: NumericBigInt.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        transaction_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        currency: {
            type: DataTypes.ENUM(['CHF', 'EUR', 'INR', 'KYD', 'OMR', 'USD']),
            defaultValue: 'USD',
        },
        user_id: {
            type: NumericBigInt.UNSIGNED,
            allowNull: true,
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
            references: {
                table: 'users',
                key: 'id',
            },
        },
        // Stripe's minor unit (cents), as the payment intent is created.
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: config.stripe.defaultAmount * 100,
        },
        stripe_customer_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Description Not Available.',
        },
        payment_status: {
            type: DataTypes.ENUM('PENDING', 'SUCCESS', 'REJECTED', 'REFUNDED'),
            allowNull: false,
            defaultValue: 'PENDING',
        },
        payment_mode: {
            type: DataTypes.ENUM('BANK_ACCOUNT', 'DEBIT_CARD', 'CREDIT_CARD', 'GOOGLE_PAY', 'PHONE_PAY', 'UNKNOWN', 'CARD'),
            allowNull: false,
            defaultValue: 'CARD',
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'payments',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    },
);

Payment.hooks.addListener('beforeDestroy', (payment) => {
    payment.is_active = false;
});

module.exports = Payment;
