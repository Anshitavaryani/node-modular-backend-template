// The billing module's tables. Payments are not associated with users (the starter does not link them).
const Payment = require('./payment.model');

module.exports = {
    models: { Payment },
    associate: () => {},
};
