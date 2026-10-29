// The content module's tables. FAQs have no associations with other tables.
const Faq = require('./faq.model');

module.exports = {
    models: { Faq },
    associate: () => {},
};
