// Reference data: what npm run seed loads (from the dataset sample in test/fixtures/geo.json and the runtime's time
// zones), and how npm run geo:update brings countries, states and cities in line with a newer dataset.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TEST_DATABASE } = require('./env');
const { start, request, close } = require('./helpers');
const { run: seed, updateGeo } = require('../src/core/db/seed');
const { Country, State, City, Timezone, Role } = require('../src/models');
const db = require('../src/core/db/central.db');

const SAMPLE = path.join(__dirname, 'fixtures', 'geo.json');
const sample = () => JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
const KARNATAKA = 4026;
const DELHI = 4021;
const WESTERN_SAHARA = 244;

// JSON columns come back parsed from MariaDB and as text from MySQL.
const seconds = (offset) => (typeof offset === 'string' ? JSON.parse(offset) : offset).seconds;

before(start);
after(close);

test('the seed loads countries, states and cities from the dataset, and time zones from the runtime', async () => {
    const data = sample();
    const cityCount = data.reduce((n, c) => n + c.states.reduce((m, s) => m + s.cities.length, 0) + (c.cities || []).length, 0);
    assert.equal(await Country.count(), data.length);
    assert.equal(await State.count(), 2);
    assert.equal(await City.count(), cityCount);

    const india = await Country.findByPk(101);
    assert.equal(india.iso2, 'IN');
    assert.equal(india.emojiU, 'U+1F1EE U+1F1F3');
    assert.equal(JSON.parse(india.timezones)[0].zoneName, 'Asia/Kolkata');

    // Western Sahara has no states: its cities hang off the country alone.
    const saharan = await City.findAll({ where: { country_id: WESTERN_SAHARA } });
    assert.equal(saharan.length, 3);
    assert.ok(saharan.every((c) => c.state_id === null && c.state_code === ''));

    // Both the runtime's zone names (Asia/Calcutta) and the dataset's (Asia/Kolkata) are there, and UTC.
    const zones = Object.fromEntries((await Timezone.findAll({ where: { time_zone: ['UTC', 'Asia/Kolkata', 'Asia/Calcutta', 'Europe/London'] } }))
        .map((z) => [z.time_zone, z]));
    assert.equal(seconds(zones.UTC.current_utc_offset), 0);
    assert.equal(seconds(zones['Asia/Kolkata'].standard_utc_offset), 19800);
    assert.equal(seconds(zones['Asia/Calcutta'].standard_utc_offset), 19800);
    assert.equal(zones['Asia/Kolkata'].has_day_light_saving, false);
    assert.equal(zones['Europe/London'].has_day_light_saving, true);
    assert.equal(seconds(zones['Europe/London'].standard_utc_offset), 0);

    // Only the super admin and user roles are seeded (the test setup adds the admin tiers).
    assert.equal((await Role.findByPk(1)).abbreviation, 'SUP_ADM');
    assert.equal((await Role.findByPk(2)).abbreviation, 'USR');

    const lines = [];
    await seed({ database: TEST_DATABASE, log: (line) => lines.push(line) });
    assert.ok(lines.length > 0 && lines.every((line) => line.startsWith('skipped')), 'a second seed changes nothing');
    assert.equal(await City.count(), cityCount);
});

test('geo:update follows the dataset: renamed and new rows, rows it dropped switched off, and back again', async () => {
    const newer = sample();
    const india = newer.find((c) => c.id === 101);
    const karnataka = india.states.find((s) => s.id === KARNATAKA);
    karnataka.name = 'Karnataka State';
    karnataka.cities.push({ id: 9999901, name: 'New Town', latitude: '12.90000000', longitude: '77.50000000' });
    india.states = india.states.filter((s) => s.id !== DELHI);
    const file = path.join(os.tmpdir(), `${TEST_DATABASE}-geo-newer.json`);
    fs.writeFileSync(file, JSON.stringify(newer));

    const restored = [];
    try {
        const lines = [];
        await updateGeo({ database: TEST_DATABASE, source: file, log: (line) => lines.push(line) });
        assert.ok(lines.includes('updated  states: 1 in the dataset, 0 added, 1 switched off'), lines.join('\n'));
        assert.ok(lines.includes('updated  cities: 16 in the dataset, 1 added, 12 switched off'), lines.join('\n'));

        assert.equal((await State.findByPk(KARNATAKA)).name, 'Karnataka State');
        assert.equal((await City.findByPk(9999901)).state_id, KARNATAKA);
        // Delhi and its cities are switched off, not deleted: hidden from the API, still in the table.
        assert.equal(await State.findByPk(DELHI), null);
        assert.equal(await City.count({ where: { state_id: DELHI } }), 0);
        const [[delhi]] = await db.query(`SELECT is_active, deleted_at FROM states WHERE id = ${DELHI}`);
        assert.equal(Number(delhi.is_active), 0);
        assert.ok(delhi.deleted_at);
        assert.equal((await request('GET', `/state/${DELHI}`)).status, 404);
    } finally {
        fs.rmSync(file, { force: true });
        // The sample again: Delhi comes back, the rename is undone, and the new city is switched off.
        await updateGeo({ database: TEST_DATABASE, source: SAMPLE, log: (line) => restored.push(line) });
    }
    assert.ok(restored.includes('updated  cities: 27 in the dataset, 0 added, 1 switched off'), restored.join('\n'));
    assert.equal((await State.findByPk(DELHI)).is_active, true);
    assert.equal((await State.findByPk(KARNATAKA)).name, 'Karnataka');
    assert.equal(await City.findByPk(9999901), null);
    assert.equal((await request('GET', `/state/${DELHI}`)).status, 200);
});
