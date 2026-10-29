const express = require('express');
const { authenticate, authenticateAdmin } = require('../identity');
const paymentController = require('./payment.controller');

const router = express.Router();

router.get('/stripe/stripe-key', authenticate, paymentController.getStripeKeys);
router.post('/stripe/create-payment-intent', authenticate, paymentController.createPaymentIntent);
// Stripe calls this without a user token; the signature check in the controller authenticates the call.
router.post('/stripe/charge-intent/webhooks', paymentController.handleChargeAndIntentWebhook);
router.get('/count', authenticateAdmin, paymentController.getNewPaymentCount);
router.get('/sum', authenticateAdmin, paymentController.getNewPaymentTotal);

module.exports = router;
