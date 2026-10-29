const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const logger = require('../../core/logger');
const paymentService = require('./payment.service');

const getStripeKeys = catchAsync(async (req, res) => {
    const { publishable_key } = paymentService.getKeys(req.query.paymentMethod);
    return responseWrapper(res, { publishable_key }, '');
});

const createPaymentIntent = catchAsync(async (req, res) => {
    const { paymentMethod, amount, currency, description } = req.body;
    const intent = await paymentService.createPaymentIntent({
        user: req.user,
        paymentMethod,
        amount,
        currency,
        description,
    });
    return responseWrapper(res, intent, '');
});

// Stripe's signature is the authentication here. Events are acknowledged and logged; no handler updates
// payment_status yet.
const handleChargeAndIntentWebhook = catchAsync(async (req, res) => {
    const event = paymentService.constructWebhookEvent(req.rawBody, req.headers['stripe-signature']);
    logger.info(`Stripe webhook event received: ${event.type}`);
    return responseWrapper(res, { received: true }, '');
});

const getNewPaymentCount = catchAsync(async (req, res) => {
    const payments = await paymentService.successfulPaymentsToday(['id']);
    return responseWrapper(res, payments.length, '');
});

const getNewPaymentTotal = catchAsync(async (req, res) => {
    const payments = await paymentService.successfulPaymentsToday(['id', 'amount']);
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return responseWrapper(res, total, '');
});

module.exports = {
    getStripeKeys,
    createPaymentIntent,
    handleChargeAndIntentWebhook,
    getNewPaymentCount,
    getNewPaymentTotal,
};
