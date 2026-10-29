// Stripe accounts, customers and payment intents, the webhook signature check, and today's payments.
const Stripe = require('stripe');
const { Op } = require('sequelize');
const config = require('../../core/config/config');
const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const logger = require('../../core/logger');
const { models: { Payment } } = require('./models');

const STRIPE_API_VERSION = '2022-11-15';
const DEFAULT_AMOUNT = Number(process.env.DEFAULT_AMOUNT) || 5;

const stripeClient = (secretKey) => new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

// Payment methods that need another country's Stripe account. Those accounts' keys are read from the environment
// (they are not in config.js).
const getKeys = (paymentMethod) => {
    let secret_key = config.STRIPE_SECRET_KEY;
    let publishable_key = config.STRIPE_PUBLISHABLE_KEY;

    switch (paymentMethod) {
        case 'grabpay':
        case 'fpx':
            publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_MY;
            secret_key = process.env.STRIPE_SECRET_KEY_MY;
            break;
        case 'au_becs_debit':
            publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_AU;
            secret_key = process.env.STRIPE_SECRET_KEY_AU;
            break;
        case 'oxxo':
            publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_MX;
            secret_key = process.env.STRIPE_SECRET_KEY_MX;
            break;
        case 'wechat_pay':
            publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_WECHAT;
            secret_key = process.env.STRIPE_SECRET_KEY_WECHAT;
            break;
        case 'paypal':
            publishable_key = process.env.STRIPE_PUBLISHABLE_KEY_UK;
            secret_key = process.env.STRIPE_SECRET_KEY_UK;
            break;
        default:
            break;
    }

    return { secret_key, publishable_key };
};

// The user's Stripe customer: created on first use and kept on the user's row.
const getCustomer = async (user, paymentMethod) => {
    const { secret_key } = getKeys(paymentMethod);
    const stripe = stripeClient(secret_key);

    if (user.stripe_customer_id) {
        return stripe.customers.retrieve(user.stripe_customer_id);
    }

    const customer = await stripe.customers.create({
        name: user.user_profile?.name,
        email: user.email,
        phone: user.user_profile?.mobile,
        description: `${config.app_name}#${user.id}#${user.role_id}#stripeCustomer`,
    });
    user.stripe_customer_id = customer.id;
    await user.save();
    return customer;
};

// Creates the Stripe payment intent and its payments row. Amounts are in cents.
const createPaymentIntent = async ({ user, paymentMethod, amount, currency, description }) => {
    const { publishable_key, secret_key } = getKeys(paymentMethod);
    const stripe = stripeClient(secret_key);

    const customer = await getCustomer(user, paymentMethod);
    const chargeAmount = (parseInt(amount, 10) || DEFAULT_AMOUNT) * 100;
    const chargeCurrency = currency || 'USD';

    const paymentIntent = await stripe.paymentIntents.create({
        customer: customer.id,
        amount: chargeAmount,
        currency: chargeCurrency,
        payment_method_types: [paymentMethod || 'card'],
        metadata: {
            name: user.user_profile?.name,
            user_name: user.user_name,
            email: user.email,
        },
    });

    const payment = await Payment.create({
        transaction_id: paymentIntent.id,
        amount: chargeAmount,
        currency: chargeCurrency,
        description,
        user_id: user.id,
        stripe_customer_id: customer.id,
    });
    if (!payment) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to initialize a Payment.');
    }

    return {
        clientSecret: paymentIntent.client_secret,
        customer: customer.id,
        publishableKey: publishable_key,
    };
};

// Checks Stripe's signature over the raw request bytes and returns the event; a mismatch is a 400.
const constructWebhookEvent = (rawBody, signature) => {
    if (!config.STRIPE_WEBHOOK_SECRET) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe webhooks are not configured.');
    try {
        const stripe = stripeClient(getKeys('').secret_key);
        return stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
        throw new ApiError(httpStatus.BAD_REQUEST, 'Webhook signature verification failed.');
    }
};

// Successful payments created today (UTC), with the given attributes.
const successfulPaymentsToday = (attributes) => {
    const today = new Date().toISOString().slice(0, 10);
    return Payment.findAll({
        attributes,
        where: {
            created_at: { [Op.between]: [`${today} 00:00:00`, `${today} 23:59:59`] },
            payment_status: 'SUCCESS',
        },
    });
};

module.exports = {
    getKeys,
    getCustomer,
    createPaymentIntent,
    constructWebhookEvent,
    successfulPaymentsToday,
};
