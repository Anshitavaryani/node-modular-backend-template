// One log line per request, as the starter's morgan setup wrote: client IP, method, URL, status and time. A failed
// request (status 400 or above) is logged as a warning (5xx as an error) with the error message the handler set.
const logger = require('../logger');

const requestLogger = (req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        const line = `${req.ip} - ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms.toFixed(1)} ms`;
        if (res.statusCode >= 500) logger.error(`${line} - message: ${res.locals.errorMessage || ''}`);
        else if (res.statusCode >= 400) logger.warn(`${line} - message: ${res.locals.errorMessage || ''}`);
        else logger.info(line);
    });
    next();
};

module.exports = requestLogger;
