// The contact module's tables. Contact-us submissions have no associations with other tables.
const ContactUs = require('./contactUs.model');

module.exports = {
    models: { ContactUs },
    associate: () => {},
};
