// Reference data for a new database: run once after `npm run migrate` on an empty database.
//
//   npm run seed          fill the reference tables that are empty
//   npm run geo:update    bring countries, states and cities in line with the latest dataset (an existing database)
//
// Roles, departments and categories come from the SQL files in ./seeds, each named after its table. The seed has only
// the super admin role, the user role and the super admin's department; a project creates its other roles from the
// admin panel. Countries, states and cities come from the countries-states-cities dataset (GEO_DATA_URL, downloaded
// unless it is a file path), time zones from the runtime (referenceData.js). Each table is filled only while it is
// empty, so running seed again changes nothing.
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { connect } = require('./migrate');
const { readDataset, geoRows, datasetZoneNames, timezoneRows } = require('./referenceData');

const SEEDS_DIR = path.join(__dirname, 'seeds');
const SQL_TABLES = ['roles', 'departments', 'categories'];
// Parents first: states point at countries, cities at both.
const GEO_TABLES = ['countries', 'states', 'cities'];
const BATCH = 2000;

// Raw queries return BIGINT results, such as a count, as strings.
const countRows = async (sequelize, table) => {
    const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    return Number(count);
};

const insertRows = async (sequelize, table, rows, options) => {
    for (let i = 0; i < rows.length; i += BATCH) {
        await sequelize.queryInterface.bulkInsert(table, rows.slice(i, i + BATCH), options);
    }
};

const run = async ({ database, log = console.log, source = config.geoDataUrl } = {}) => {
    const sequelize = connect(database);
    try {
        for (const table of SQL_TABLES) {
            const count = await countRows(sequelize, table);
            if (count > 0) {
                log(`skipped  ${table} (already has ${count} rows)`);
                continue;
            }
            // Dumped values never contain a raw line break, so ";" at a line end ends a statement.
            const sql = fs.readFileSync(path.join(SEEDS_DIR, `${table}.sql`), 'utf8');
            const statements = sql.split(/;\r?\n/).map((s) => s.trim()).filter(Boolean);
            await sequelize.transaction(async (transaction) => {
                for (const statement of statements) await sequelize.query(statement, { transaction });
            });
            log(`seeded   ${table} (${await countRows(sequelize, table)} rows)`);
        }

        const emptyGeoTables = [];
        for (const table of GEO_TABLES) {
            const count = await countRows(sequelize, table);
            if (count > 0) log(`skipped  ${table} (already has ${count} rows; npm run geo:update refreshes it)`);
            else emptyGeoTables.push(table);
        }
        let dataset;
        if (emptyGeoTables.length) {
            log(`loading  countries, states and cities from ${source}`);
            dataset = await readDataset(source);
            const rows = geoRows(dataset);
            await sequelize.transaction(async (transaction) => {
                for (const table of emptyGeoTables) await insertRows(sequelize, table, rows[table], { transaction });
            });
            for (const table of emptyGeoTables) log(`seeded   ${table} (${rows[table].length} rows)`);
        }

        const timezones = await countRows(sequelize, 'timezones');
        if (timezones > 0) {
            log(`skipped  timezones (already has ${timezones} rows)`);
        } else {
            const rows = timezoneRows(dataset ? datasetZoneNames(dataset) : []);
            await insertRows(sequelize, 'timezones', rows);
            log(`seeded   timezones (${rows.length} rows)`);
        }
    } finally {
        await sequelize.close();
    }
};

// Makes countries, states and cities match the dataset: changed rows are updated, new ones added, and rows the
// dataset no longer has are switched off (is_active 0, deleted_at set), not deleted, so rows that point at them keep
// working. A row that comes back is switched on again.
const updateGeo = async ({ database, log = console.log, source = config.geoDataUrl } = {}) => {
    log(`loading  countries, states and cities from ${source}`);
    const rows = geoRows(await readDataset(source));
    const sequelize = connect(database);
    try {
        await sequelize.transaction(async (transaction) => {
            for (const table of GEO_TABLES) {
                const [existing] = await sequelize.query(`SELECT id, deleted_at IS NULL AS live FROM \`${table}\``, { transaction });
                const known = new Set(existing.map((r) => Number(r.id)));
                const live = existing.filter((r) => Number(r.live) === 1).map((r) => Number(r.id));
                const incoming = new Set(rows[table].map((r) => r.id));
                const columns = Object.keys(rows[table][0]).filter((column) => column !== 'id');
                await insertRows(sequelize, table, rows[table], { transaction, updateOnDuplicate: columns });
                const gone = live.filter((id) => !incoming.has(id));
                const now = new Date();
                for (let i = 0; i < gone.length; i += BATCH) {
                    await sequelize.queryInterface.bulkUpdate(
                        table,
                        { is_active: 0, deleted_at: now, updated_at: now },
                        { id: gone.slice(i, i + BATCH) },
                        { transaction },
                    );
                }
                const added = rows[table].filter((r) => !known.has(r.id)).length;
                log(`updated  ${table}: ${rows[table].length} in the dataset, ${added} added, ${gone.length} switched off`);
            }
        });
    } finally {
        await sequelize.close();
    }
};

module.exports = { run, updateGeo };

if (require.main === module) {
    const command = process.argv[2] === '--update-geo' ? updateGeo : run;
    command().catch((error) => {
        console.error(`Seeding failed: ${error.message}`);
        process.exit(1);
    });
}
