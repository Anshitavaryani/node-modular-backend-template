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

// Stripe's signature is the authentication here. Payment outcomes and full refunds update payments.payment_status
// (see applyWebhookEvent); other events are acknowledged.
const handleChargeAndIntentWebhook = catchAsync(async (req, res) => {
    const event = paymentService.constructWebhookEvent(req.rawBody, req.headers['stripe-signature']);
    const updated = await paymentService.applyWebhookEvent(event);
    logger.info(`Stripe webhook ${event.type} (${event.id}): ${updated} payment(s) updated.`);
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
