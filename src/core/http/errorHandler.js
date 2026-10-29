const ApiError = require('./ApiError');
const httpStatus = require('./status');
const logger = require('../logger');

// Stripe's errors about the payment itself (a declined card, a missing payment method) carry a 4xx status and a
// message written for the payer ("Your card was declined.").
const isStripeClientError = (err) =>
    typeof err.type === 'string' && err.type.startsWith('Stripe') && err.statusCode >= 400 && err.statusCode < 500;

// Last middleware: turns any error into the JSON error shape. Expected errors (ApiError) return their
// own status and message; Stripe payment errors return Stripe's status and message; anything else is logged
// with its stack and returned as a generic 500, so database and library messages never reach clients.
// oxlint-disable-next-line no-unused-vars -- Express recognises error handlers by their four parameters.
const errorHandler = (err, req, res, next) => {
    res.locals.errorMessage = err.message;
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            status: err.statusCode,
            message: err.message,
            ...(err.code && { code: err.code }),
            ...(err.details && { details: err.details }),
            data: '',
        });
    }
    if (isStripeClientError(err)) {
        logger.warn(`${req.method} ${req.originalUrl}: Stripe ${err.type} ${err.code || ''}: ${err.message}`);
        return res.status(err.statusCode).json({
            success: false,
            status: err.statusCode,
            message: err.message,
            code: 'PAYMENT_FAILED',
            data: '',
        });
    }
    // A database constraint the request broke (a duplicate that got past an earlier check, a value a model rejects, a
    // value longer than its column) is the client's to fix: 400, as the starter did for the first two. Only the field
    // names are returned, not the library's wording.
    const duplicate = err.name === 'SequelizeUniqueConstraintError';
    const tooLong = err.name === 'SequelizeDatabaseError' && err.parent?.code === 'ER_DATA_TOO_LONG';
    if (duplicate || tooLong || err.name === 'SequelizeValidationError') {
        logger.warn(`${req.method} ${req.originalUrl}: ${err.name}: ${err.message}`);
        const fields = tooLong
            ? [/column '([^']+)'/.exec(err.parent.sqlMessage || '')?.[1]]
            : (err.errors || []).map((e) => e.path);
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            status: httpStatus.BAD_REQUEST,
            message: duplicate ? 'This record already exists.' : tooLong ? 'A value is too long.' : 'Invalid data.',
            details: fields.filter(Boolean),
            data: '',
        });
    }
    logger.error(`${req.method} ${req.originalUrl}`, err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: 'An internal server error occurred.',
        data: '',
    });
};

module.exports = errorHandler;
