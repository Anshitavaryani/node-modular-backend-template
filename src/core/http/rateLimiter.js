// Request limits. Counters live in Redis (core/redis), so every app process shares one count and a restart keeps it.
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const config = require('../config/config');
const redis = require('../redis/redis');

// Each limiter gets its own key namespace in Redis.
const store = (name) => new RedisStore({
    prefix: `rl:${name}:`,
    sendCommand: (...args) => redis.call(...args),
});

const limiter = (name, { windowMs, limit, message }) => rateLimit({
    windowMs,
    limit,
    store: store(name),
    message: { success: false, status: 429, code: 'TOO_MANY_REQUESTS', message },
    standardHeaders: true,
    legacyHeaders: false,
});

// Sign-in, registration and password-reset requests: 15 per 15 minutes per IP, counting every request.
const authLimiter = limiter('auth', {
    windowMs: 15 * 60 * 1000,
    limit: 15,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
});

// Limits apply in production only, so development and tests are not slowed down by them.
const productionOnly = (middleware) => (config.env === 'production' ? middleware : (req, res, next) => next());

module.exports = {
    authLimiter: productionOnly(authLimiter),
    limiter: (name, options) => productionOnly(limiter(name, options)),
};
