// Shared helpers for the feature tests: a running server, JSON requests, a super admin, and one-time codes.
require('./env');
const app = require('../app');
const db = require('../src/core/db/central.db');
const redis = require('../src/core/redis/redis');
const { OTP, Role, Department } = require('../src/models');
const { createAdminUser } = require('../src/shared/identity');

let server;
let baseUrl;

const start = () => new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
        resolve(baseUrl);
    });
});

// JSON request. `token` is sent as x-access-token (the header the starter uses for both users and admins).
const request = async (method, path, { body, token, headers = {} } = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'x-access-token': token }),
            ...headers,
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
};

// Creates a super admin once per test database and returns its sign-in details.
const SUPER = { name: 'Test Super', email: 'super@test.example', password: 'Passw0rd#Super1' };
const ensureSuperAdmin = async () => {
    const existing = await require('../src/models').Admin.findOne({ where: { email: SUPER.email } });
    if (!existing) {
        const role = await Role.findOne({ where: { abbreviation: 'SUP_ADM' } });
        const dept = await Department.findOne({ order: [['id', 'ASC']] });
        await createAdminUser({ ...SUPER, role_id: role.id, department_id: dept.id });
    }
    return SUPER;
};

// Latest unused one-time code for an email and type (the mail goes to the log in tests).
const latestCode = async (email, type) => {
    const row = await OTP.findOne({ where: { email, type }, order: [['id', 'DESC']] });
    return row && row.code;
};

const close = async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([db.close(), redis.quit()]);
};

module.exports = { start, request, ensureSuperAdmin, latestCode, close, SUPER };
