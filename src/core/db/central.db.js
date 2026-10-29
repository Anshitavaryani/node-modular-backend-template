const { Sequelize } = require('sequelize');
const config = require('../config/config');
const logger = require('../logger');

const sequelize = new Sequelize(
    config.databases.central.db,
    config.databases.central.user,
    config.databases.central.passwd,
    {
        host: config.databases.central.host,
        port: config.databases.central.port,
        dialect: 'mysql',
        supportBigNumbers: true,
        // JSON columns are text in MariaDB; keep them as strings, as the code expects.
        dialectOptions: { jsonStrings: true, charset: 'utf8mb4' },
        collate: 'utf8mb4_unicode_ci',
        timezone: '+00:00', // store and read dates in UTC, whatever the server's time zone
        pool: { max: 10, min: 0, idle: 10000, acquire: 30000, evict: 15000 },
        logging: config.env === 'development' ? (message) => logger.debug(message) : false,
    },
);

// Checked once at start-up by index.js (retrying while the database container boots).
const connect = async ({ attempts = 5, delayMs = 3000 } = {}) => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            await sequelize.authenticate();
            logger.info('Primary database connection established.');
            return;
        } catch (error) {
            if (attempt >= attempts) throw error;
            logger.warn(`Database connection attempt ${attempt}/${attempts} failed: ${error.message}`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};

module.exports = sequelize;
module.exports.connect = connect;
