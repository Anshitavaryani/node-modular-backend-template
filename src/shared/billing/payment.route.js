const express = require('express');
const { authenticate, authenticateAdmin, requireRole, ROLE } = require('../identity');
const paymentController = require('./payment.controller');

const router = express.Router();

// Payment totals are for the admin tier only (as in the starter): super admin, admin or sub-admin.
const requireAdminTier = [authenticateAdmin, requireRole(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN)];

router.get('/stripe/stripe-key', authenticate, paymentController.getStripeKeys);
router.post('/stripe/create-payment-intent', authenticate, paymentController.createPaymentIntent);
// Stripe calls this without a user token; the signature check in the controller authenticates the call.
router.post('/stripe/charge-intent/webhooks', paymentController.handleChargeAndIntentWebhook);
router.get('/count', requireAdminTier, paymentController.getNewPaymentCount);
router.get('/sum', requireAdminTier, paymentController.getNewPaymentTotal);

module.exports = router;
