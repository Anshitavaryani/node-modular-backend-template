// Reference data that is fetched or built at seed time instead of kept as SQL files:
//   - countries, states and cities from the countries-states-cities dataset (github.com/dr5hn/countries-states-cities-database,
//     ODbL-1.0), its "countries+states+cities" JSON export: config.geoDataUrl, a URL or a file path, gzipped or not;
//   - time zones from the runtime's own list, plus the zone names the dataset uses.
const fs = require('fs');
const zlib = require('zlib');

const readDataset = async (source) => {
    let buffer;
    if (/^https?:\/\//.test(source)) {
        const res = await fetch(source);
        if (!res.ok) throw new Error(`Downloading ${source} failed: HTTP ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
    } else {
        buffer = fs.readFileSync(source);
    }
    // A gzip file starts with the bytes 1f 8b.
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) buffer = zlib.gunzipSync(buffer);
    const dataset = JSON.parse(buffer.toString('utf8'));
    if (!Array.isArray(dataset) || !dataset.length) throw new Error(`${source} holds no countries`);
    return dataset;
};

const json = (value) => (value == null ? null : JSON.stringify(value));

// Rows for the countries, states and cities tables. Every row is live (is_active 1, not deleted), so an update brings
// back a row that the dataset had dropped and restored. A few cities belong to a country with no states: their
// state_id is null and their state_code empty.
const geoRows = (dataset) => {
    const live = { is_active: 1, deleted_at: null };
    const countries = [];
    const states = [];
    const cities = [];
    const city = (c, country, state) => ({
        id: c.id,
        name: c.name,
        country_id: country.id,
        country_code: country.iso2,
        state_id: state ? state.id : null,
        state_code: state ? state.iso2 : '',
        latitude: c.latitude,
        longitude: c.longitude,
        ...live,
    });
    for (const country of dataset) {
        countries.push({
            id: country.id,
            name: country.name,
            iso3: country.iso3 ?? null,
            numeric_code: country.numeric_code ?? null,
            iso2: country.iso2 ?? null,
            phonecode: country.phonecode ?? null,
            capital: country.capital ?? null,
            currency: country.currency ?? null,
            currency_name: country.currency_name ?? null,
            currency_symbol: country.currency_symbol ?? null,
            tld: country.tld ?? null,
            native: country.native ?? null,
            region: country.region ?? null,
            subregion: country.subregion ?? null,
            timezones: json(country.timezones),
            translations: json(country.translations),
            latitude: country.latitude ?? null,
            longitude: country.longitude ?? null,
            emoji: country.emoji ?? null,
            emoji_u: country.emojiU ?? null,
            flag: 1,
            wiki_data_id: country.wikiDataId ?? null,
            ...live,
        });
        for (const state of country.states || []) {
            states.push({
                id: state.id,
                name: state.name,
                country_id: country.id,
                country_code: country.iso2,
                iso2: state.iso2 ?? null,
                type: state.type ?? null,
                latitude: state.latitude ?? null,
                longitude: state.longitude ?? null,
                wiki_data_id: state.wikiDataId ?? null,
                ...live,
            });
            for (const c of state.cities || []) cities.push(city(c, country, state));
        }
        for (const c of country.cities || []) cities.push(city(c, country, null));
    }
    return { countries, states, cities };
};

// The zone names the dataset gives its countries (current IANA names, such as Asia/Kolkata).
const datasetZoneNames = (dataset) => dataset.flatMap((country) => (country.timezones || []).map((t) => t.zoneName));

// Whether the runtime knows a zone name (an unknown one makes Intl throw).
const isKnownZone = (timeZone) => {
    try {
        return Boolean(new Intl.DateTimeFormat('en-US', { timeZone }));
    } catch {
        return false;
    }
};

// A zone's UTC offset at `date`, in seconds.
const offsetSeconds = (timeZone, date) => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName').value; // "GMT+05:30", "GMT-03:00" or "GMT"
    const match = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(name);
    if (!match) return 0;
    const seconds = Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] || 0);
    return match[1] === '-' ? -seconds : seconds;
};

// An offset in the timezones table's JSON form.
const offsetJson = (seconds) =>
    JSON.stringify({ seconds, milliseconds: seconds * 1000, ticks: seconds * 1e7, nanoseconds: seconds * 1e9 });

// Rows for the timezones table: the runtime's zones (Node names some by their older names, such as Asia/Calcutta),
// UTC, and any extra names, each with its offsets as of `now`. A zone has daylight saving when its offsets in January
// and July differ; the smaller one is its standard offset. The offsets are a snapshot: nothing refreshes them.
const timezoneRows = (extraNames = [], now = new Date()) => {
    const year = now.getUTCFullYear();
    const january = new Date(Date.UTC(year, 0, 1, 12));
    const july = new Date(Date.UTC(year, 6, 1, 12));
    const names = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC', ...extraNames]);
    const rows = [];
    for (const timeZone of [...names].filter(isKnownZone).toSorted()) {
        const current = offsetSeconds(timeZone, now);
        const standard = Math.min(offsetSeconds(timeZone, january), offsetSeconds(timeZone, july));
        const hasDaylightSaving = offsetSeconds(timeZone, january) !== offsetSeconds(timeZone, july);
        rows.push({
            time_zone: timeZone,
            // Wall-clock time in the zone, stored as is (dates are written in UTC).
            current_local_time: new Date(now.getTime() + current * 1000),
            current_utc_offset: offsetJson(current),
            standard_utc_offset: offsetJson(standard),
            has_day_light_saving: hasDaylightSaving,
            is_day_light_saving_active: current !== standard,
        });
    }
    return rows;
};

module.exports = { readDataset, geoRows, datasetZoneNames, timezoneRows };
