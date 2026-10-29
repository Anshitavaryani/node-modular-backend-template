// Reference data for a new database: run once after `npm run migrate` on an empty database.
//
//   npm run seed
//
// Each file in ./seeds fills the table it is named after, and only while that table is empty, so running it again
// changes nothing. Parents come before children (states point at countries, cities at both).
const fs = require('fs');
const path = require('path');
const { connect } = require('./migrate');

const SEEDS_DIR = path.join(__dirname, 'seeds');
const TABLES = ['roles', 'departments', 'countries', 'states', 'cities', 'categories', 'timezones'];
// The city dumps are large INSERTs: they load in these parts, in order, into the same table.
const PARTS = { cities: ['cities.sql', 'cities1.sql', 'cities2.sql', 'cities3.sql', 'cities4.sql', 'cities5.sql'] };

const run = async ({ database, log = console.log } = {}) => {
    const sequelize = connect(database);
    try {
        for (const table of TABLES) {
            const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
            if (count > 0) {
                log(`skipped  ${table} (already has ${count} rows)`);
                continue;
            }
            const files = PARTS[table] || [`${table}.sql`];
            // Dumped values never contain a raw line break, so ";" at a line end ends a statement.
            await sequelize.transaction(async (transaction) => {
                for (const file of files) {
                    const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
                    const statements = sql.split(/;\r?\n/).map((s) => s.trim()).filter(Boolean);
                    for (const statement of statements) await sequelize.query(statement, { transaction });
                }
            });
            const [[{ seeded }]] = await sequelize.query(`SELECT COUNT(*) AS seeded FROM \`${table}\``);
            log(`seeded   ${table} (${seeded} rows)`);
        }
    } finally {
        await sequelize.close();
    }
};

module.exports = { run };

if (require.main === module) {
    run().catch((error) => {
        console.error(`Seeding failed: ${error.message}`);
        process.exit(1);
    });
}
