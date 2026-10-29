const app = require('./app');
const config = require('./src/core/config/config');
const logger = require('./src/core/logger');
const db = require('./src/core/db/central.db');
const redis = require('./src/core/redis/redis');
const redisConnection = require('./src/core/redis/connection');
const jobs = require('./src/jobs');

process.env.TZ = config.DEFAULT_TIMEZONE;

let server;

const shutdown = async (signal) => {
    logger.info(`${signal} received: closing.`);
    if (server) server.close();
    await Promise.allSettled([db.close(), redis.quit()]);
    process.exit(0);
};

const start = async () => {
    // Both must be reachable before the app serves traffic: a missing database or Redis fails start-up here.
    await db.connect();
    await redisConnection.connect();
    server = app.listen(config.port, () => {
        logger.info(`${config.app_name} listening on port ${config.port} (${config.env}), time zone ${process.env.TZ}.`);
    });
    if (config.jobsEnabled) jobs.start();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection', error);
    process.exit(1);
});

start().catch((error) => {
    logger.error('Start-up failed', error);
    process.exit(1);
});
