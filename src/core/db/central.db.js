const { Sequelize } = require('@sequelize/core');
const config = require('../config/config');
const logger = require('../logger');
const { sequelizeOptions } = require('./options');

const sequelize = new Sequelize(sequelizeOptions({
    pool: { max: 10, min: 0, idle: 10000, acquire: 30000, evict: 15000 },
    logging: config.env === 'development' ? (message) => logger.debug(message) : false,
}));

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
