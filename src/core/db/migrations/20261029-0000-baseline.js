// The schema the models define when the template was made (schema/baseline.sql). An empty database gets the tables;
// a database that already has them (a restored copy, an existing project) only records this migration.
const fs = require('fs');
const path = require('path');

module.exports = {
    up: async ({ sequelize }) => {
        const [tables] = await sequelize.query("SHOW TABLES LIKE 'roles'");
        if (tables.length) return;
        const sql = fs.readFileSync(path.join(__dirname, '..', 'schema', 'baseline.sql'), 'utf8');
        const statements = sql
            .split(/;\s*\n/)
            .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
            .filter(Boolean);
        for (const statement of statements) await sequelize.query(statement);
    },
    down: async () => {
        throw new Error('The baseline cannot be reverted');
    },
};
