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

// skipSuccessfulRequests: only responses with status 400 or above count against the limit.
const limiter = (name, { windowMs, limit, message, skipSuccessfulRequests = false }) => rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    store: store(name),
    message: { success: false, status: 429, code: 'TOO_MANY_REQUESTS', message, data: '' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Every /user/auth and /admin/auth request, as in the starter: 20 failed requests per 15 minutes per IP. Successful
// ones are not counted, so an office where many people sign in from one IP is never locked out; repeated failures
// (guessed passwords, codes, tokens) are.
const authLimiter = limiter('auth', {
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    message: 'Too many attempts. Please try again later.',
});

// One-time code requests send an email even when they succeed, so every request counts: 10 per 15 minutes per IP.
// (The per-email cooldown stops repeats to one address; this stops one IP mailing many addresses.)
const codeLimiter = limiter('code', {
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many code requests. Please try again later.',
});

// Limits apply in production only, so development and tests are not slowed down by them.
const productionOnly = (middleware) => (config.env === 'production' ? middleware : (req, res, next) => next());

module.exports = {
    authLimiter: productionOnly(authLimiter),
    codeLimiter: productionOnly(codeLimiter),
    limiter: (name, options) => productionOnly(limiter(name, options)),
};
