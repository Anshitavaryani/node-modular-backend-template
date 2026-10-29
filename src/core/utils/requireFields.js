const ApiError = require('../http/ApiError');
const httpStatus = require('../http/status');

// Throws a 400 naming the fields of `body` that are missing or blank. Each field must be a non-empty string.
const requireFields = (body, fields) => {
    const missing = fields.filter((field) => typeof body?.[field] !== 'string' || body[field].trim() === '');
    if (missing.length) throw new ApiError(httpStatus.BAD_REQUEST, `Please Enter Required Fields : [${missing.join(', ')}]`);
};

module.exports = requireFields;
