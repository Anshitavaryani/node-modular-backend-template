// The Redis client, shared by the whole app: rate limits, short-lived keys (one-time-code cooldowns, login lockouts)
// and the health check. One connection per process; it is opened by index.js at start-up (see connect()).
const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('../logger');

const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    keyPrefix: config.redis.keyPrefix,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (error) => logger.warn(`Redis error: ${error.message}`));
redis.on('ready', () => logger.info('Redis connection ready.'));

module.exports = redis;
