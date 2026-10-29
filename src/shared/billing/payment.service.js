// Stripe accounts, customers and payment intents, the webhook (signature check and payment status), and today's
// payments.
const Stripe = require('stripe');
const { Op } = require('@sequelize/core');
const config = require('../../core/config/config');
const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const logger = require('../../core/logger');
const { models: { Payment } } = require('./models');

// Payment methods served by another country's Stripe account (config.stripe.accounts).
const METHOD_ACCOUNTS = {
    grabpay: 'MY',
    fpx: 'MY',
    au_becs_debit: 'AU',
    oxxo: 'MX',
    wechat_pay: 'WECHAT',
    paypal: 'UK',
};

// The currencies a payment may use (the payments.currency enum), and how many minor units make one unit. Stripe takes
// amounts in minor units; OMR has three decimals.
const CURRENCIES = Payment.getAttributes().currency.type.options.values;
const MINOR_UNITS = { OMR: 1000 };

// Keys for a payment method: its country account when that account is set up, otherwise the main account.
const getKeys = (paymentMethod) => {
    const account = config.stripe.accounts[METHOD_ACCOUNTS[paymentMethod]];
    const keys = account?.secretKey ? account : config.stripe;
    return { secret_key: keys.secretKey, publishable_key: keys.publishableKey };
};

// One client per account. No apiVersion is set: each SDK release pins the Stripe API version it was built for, so
// upgrading the stripe package upgrades the API with it.
const clients = new Map();
const stripeClient = (secretKey) => {
    if (!secretKey) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Payments are not configured.');
    if (!clients.has(secretKey)) clients.set(secretKey, new Stripe(secretKey));
    return clients.get(secretKey);
};

// The user's Stripe customer: created on first use and kept on the user's row. A customer deleted in Stripe, or one
// that belongs to another account, is replaced.
const getCustomer = async (user, stripe) => {
    if (user.stripe_customer_id) {
        try {
            const existing = await stripe.customers.retrieve(user.stripe_customer_id);
            if (!existing.deleted) return existing;
        } catch (error) {
            if (error.code !== 'resource_missing') throw error;
        }
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

// Checks the amount (whole units; DEFAULT_AMOUNT when none is sent) and the currency before anything reaches Stripe.
const chargeFor = (amount, currency) => {
    const units = amount === undefined || amount === null || amount === '' ? config.stripe.defaultAmount : Number(amount);
    if (!Number.isInteger(units) || units <= 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'amount must be a whole number greater than 0.');
    }
    const code = String(currency || 'USD').toUpperCase();
    if (!CURRENCIES.includes(code)) {
        throw new ApiError(httpStatus.BAD_REQUEST, `currency must be one of ${CURRENCIES.join(', ')}.`);
    }
    return { amount: units * (MINOR_UNITS[code] || 100), currency: code };
};

// Creates the Stripe payment intent and its payments row (status PENDING until the webhook reports the outcome).
const createPaymentIntent = async ({ user, paymentMethod, amount, currency, description }) => {
    const charge = chargeFor(amount, currency);
    const { publishable_key, secret_key } = getKeys(paymentMethod);
    const stripe = stripeClient(secret_key);
    const customer = await getCustomer(user, stripe);

    const paymentIntent = await stripe.paymentIntents.create({
        customer: customer.id,
        amount: charge.amount,
        currency: charge.currency.toLowerCase(),
        // A named method is used as asked; otherwise Stripe offers the methods switched on in its dashboard.
        ...(paymentMethod
            ? { payment_method_types: [paymentMethod] }
            : { automatic_payment_methods: { enabled: true } }),
        metadata: {
            user_id: String(user.id),
            name: user.user_profile?.name,
            user_name: user.user_name,
            email: user.email,
        },
    });

    const payment = await Payment.create({
        transaction_id: paymentIntent.id,
        amount: charge.amount,
        currency: charge.currency,
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
    if (!config.stripe.webhookSecret) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe webhooks are not configured.');
    try {
        return Stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    } catch (error) {
        logger.warn(`Stripe webhook signature verification failed: ${error.message}`);
        throw new ApiError(httpStatus.BAD_REQUEST, 'Webhook signature verification failed.');
    }
};

// The events that change a payment's status, and the statuses each may change. Stripe can send an event twice or out
// of order, so a late failure never overwrites a success, and only a successful payment becomes refunded.
const STATUS_EVENTS = {
    'payment_intent.succeeded': { to: 'SUCCESS', from: ['PENDING', 'REJECTED'] },
    'payment_intent.payment_failed': { to: 'REJECTED', from: ['PENDING'] },
    'payment_intent.canceled': { to: 'REJECTED', from: ['PENDING'] },
    'charge.refunded': { to: 'REFUNDED', from: ['SUCCESS'] },
};

// Applies a verified event to its payments row. Returns how many rows changed (0 for other events).
const applyWebhookEvent = async (event) => {
    const change = STATUS_EVENTS[event.type];
    if (!change) return 0;
    const object = event.data.object;
    let intentId = object.id;
    if (event.type === 'charge.refunded') {
        // The event carries the charge; a partial refund leaves the payment as it is.
        if (!object.refunded) return 0;
        intentId = typeof object.payment_intent === 'object' ? object.payment_intent?.id : object.payment_intent;
    }
    if (!intentId) return 0;
    const [updated] = await Payment.update(
        { payment_status: change.to },
        { where: { transaction_id: intentId, payment_status: change.from } },
    );
    return updated;
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
    applyWebhookEvent,
    successfulPaymentsToday,
};
