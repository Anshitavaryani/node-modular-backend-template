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

// Creates an admin with the role that has this abbreviation (SUP_ADM, ADM, SUB_ADM, ENG...).
const createAdmin = async ({ name, email, password, role }) => {
    const roleRow = await Role.findOne({ where: { abbreviation: role } });
    const dept = await Department.findOne({ order: [['id', 'ASC']] });
    await createAdminUser({ name, email, password, role_id: roleRow.id, department_id: dept.id });
    return { name, email, password };
};

// Admin sign-in token.
const signInAdmin = async ({ email, password }) => {
    const res = await request('POST', '/admin/auth/login', { body: { email, password } });
    if (res.status !== 200) throw new Error(`admin sign-in failed for ${email}: ${res.status} ${res.body.message}`);
    return res.body.data.token;
};

// A verified, signed-in user with the default role, made through the public API: register, verify the emailed code,
// sign in. Returns the access token. Registration starts the 60 s code cooldown for this email.
const signUpUser = async ({ name, email, mobile, password }) => {
    const registered = await request('POST', '/user/auth/register', { body: { name, email, mobile, password, confirm_password: password } });
    if (registered.status !== 201) throw new Error(`registration failed for ${email}: ${registered.status} ${registered.body.message}`);
    const otp = await latestCode(email, 'email_varification');
    await request('POST', '/user/auth/verify-otp', { body: { email, otp, type: 'email_varification' } });
    const signedIn = await request('POST', '/user/auth/login', { body: { email, password } });
    if (signedIn.status !== 200) throw new Error(`sign-in failed for ${email}: ${signedIn.status} ${signedIn.body.message}`);
    return signedIn.body.data.tokens.access.token;
};

// The running server's API base URL (http://127.0.0.1:<port>/api/v1), for requests request() cannot make.
const apiUrl = () => baseUrl;

const close = async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([db.close(), redis.quit()]);
};

module.exports = { start, apiUrl, request, ensureSuperAdmin, latestCode, createAdmin, signInAdmin, signUpUser, close, SUPER };
