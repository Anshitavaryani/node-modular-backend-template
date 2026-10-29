// Sequelize options for the central database, shared by the app's pool (central.db.js) and the migration and seed
// runner's single connection (migrate.js).
const config = require('../config/config');

// The dialect for the server (CENTRAL_DB_DIALECT): MariaDB's own by default, MySQL's for MySQL 8. Only the one in use
// is loaded.
const DIALECTS = {
    mariadb: () => require('@sequelize/mariadb').MariaDbDialect,
    mysql: () => require('@sequelize/mysql').MySqlDialect,
};

const sequelizeOptions = ({ database, ...overrides } = {}) => {
    const { dialect, host, port, db, user, passwd } = config.databases.central;
    return {
        dialect: DIALECTS[dialect](),
        host,
        port,
        user,
        password: passwd,
        database: database || db,
        timezone: '+00:00', // store and read dates in UTC, whatever the server's time zone
        // Sequelize 7 refuses a value that does not match its column type (a number for a string column); the starter
        // stored it as given. Requests are validated before they reach the database instead.
        noTypeValidation: true,
        logging: false,
        ...overrides,
    };
};

module.exports = { sequelizeOptions };
