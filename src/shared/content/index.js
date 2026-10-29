// FAQ: the public list and admin management of its entries.
module.exports = {
    // Mounted under /api/v1 by src/routes.js.
    routes: () => [
        { path: '/faq', router: require('./faq.route') },
    ],
};
