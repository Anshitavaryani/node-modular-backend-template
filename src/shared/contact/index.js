// Contact-us submissions from the public contact form, and their admin review.
module.exports = {
    // Mounted under /api/v1 by src/routes.js.
    routes: () => [
        { path: '/contactUs', router: require('./contactUs.route') },
    ],
};
