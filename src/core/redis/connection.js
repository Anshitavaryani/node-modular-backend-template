// Start-up and health for the Redis client (core/redis/redis.js). Kept apart from the client so the client's own
// methods (connect, reconnect) are never replaced.
const redis = require('./redis');
const logger = require('../logger');

// Opens the connection, retrying while Redis boots. Throws when it cannot connect (start-up fails loudly).
const connect = async ({ attempts = 5, delayMs = 2000 } = {}) => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            if (redis.status === 'wait') await redis.connect();
            await redis.ping();
            return;
        } catch (error) {
            if (attempt >= attempts) throw error;
            logger.warn(`Redis connection attempt ${attempt}/${attempts} failed: ${error.message}`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};

// For the health check: true when Redis answers PING.
const isHealthy = async () => {
    try {
        return (await redis.ping()) === 'PONG';
    } catch {
        return false;
    }
};

module.exports = { connect, isHealthy };
