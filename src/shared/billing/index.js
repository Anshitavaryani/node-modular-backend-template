// Payments: Stripe keys, customers and payment intents, the Stripe webhook, and today's payment totals.
module.exports = {
    // Mounted under /api/v1 by src/routes.js.
    routes: () => [
        { path: '/payment', router: require('./payment.route') },
    ],
};
