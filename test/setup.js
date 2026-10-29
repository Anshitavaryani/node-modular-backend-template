// Global test setup (runs once per `npm test`): create the test database if needed, empty it, and build it from the
// migrations and seeds, so the tests run against exactly the schema a deploy produces.
const { TEST_DATABASE } = require('./env');
const mysql = require('mysql2/promise');
const config = require('../src/core/config/config');
const { run: migrate, connect } = require('../src/core/db/migrate');
const { run: seed } = require('../src/core/db/seed');
const redis = require('../src/core/redis/redis');

async function globalSetup() {
    if (!TEST_DATABASE.endsWith('_test')) throw new Error(`Refusing to reset ${TEST_DATABASE}: not a *_test database`);
    const { host, port, user, passwd } = config.databases.central;
    const admin = await mysql.createConnection({ host, port, user, password: passwd });
    try {
        await admin.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        const [tables] = await admin.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?', [TEST_DATABASE]);
        await admin.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const { t } of tables) await admin.query(`DROP TABLE \`${TEST_DATABASE}\`.\`${t}\``);
        await admin.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await admin.end();
    }
    await migrate('up', { database: TEST_DATABASE, log: () => {} });
    await seed({ database: TEST_DATABASE, log: () => {} });
    // The admin tiers the code checks (ROLE in src/shared/identity/constants.js). The seed has only the super admin and
    // user roles; a project creates these from the admin panel.
    const db = connect(TEST_DATABASE);
    try {
        await db.query("INSERT INTO roles (name, abbreviation) VALUES ('Admin', 'ADM'), ('Sub Admin', 'SUB_ADM'), ('Engineer', 'ENG'), ('Editor', 'EDTR')");
    } finally {
        await db.close();
    }
    // Empty the test Redis database (cooldowns and lockouts from earlier runs would refuse the first sign-ins).
    // Only the test database index is flushed, never the server's other databases.
    if (String(config.redis.db) !== process.env.REDIS_DB) throw new Error('Refusing to flush: not the test Redis database');
    await redis.flushdb();
    await redis.quit();
}

module.exports = { globalSetup };
