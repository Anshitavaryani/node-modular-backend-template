// Accounts: registration, one-time codes, sign-in and lockout, profile, and admin accounts.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, request, ensureSuperAdmin, latestCode, close } = require('./helpers');

const USER = { name: 'Ann Test', email: 'ann.identity@test.example', mobile: '9999900001', password: 'Passw0rd12', confirm_password: 'Passw0rd12' };
const USER_ROLE = { 'role_id': '6' };
let userToken;
let superAdmin;

before(async () => {
    await start();
    superAdmin = await ensureSuperAdmin();
});
after(close);

test('self-registration refuses a role that is not self-registerable', async () => {
    const res = await request('POST', '/user/auth/register', { body: USER, headers: { role_id: '1' } });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Invalid role for self-registration/);
});

test('registration creates the account and reports success', async () => {
    const res = await request('POST', '/user/auth/register', { body: USER, headers: USER_ROLE });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
});

test('sign-in is refused until the email is verified', async () => {
    const res = await request('POST', '/user/auth/login', { body: { email: USER.email, password: USER.password }, headers: USER_ROLE });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /verify otp/i);
});

test('a second code within the cooldown is refused', async () => {
    await request('POST', '/user/auth/otp', { body: { email: USER.email, type: 'email_varification' }, headers: USER_ROLE });
    const again = await request('POST', '/user/auth/otp', { body: { email: USER.email, type: 'email_varification' }, headers: USER_ROLE });
    assert.equal(again.status, 429);
    assert.equal(again.body.code, 'TOO_MANY_REQUESTS');
});

test('a wrong code is refused and the right one verifies the email', async () => {
    const code = await latestCode(USER.email, 'email_varification');
    assert.ok(code, 'a verification code was stored');
    const wrong = await request('POST', '/user/auth/verify-otp', { body: { email: USER.email, otp: '000000', type: 'email_varification' }, headers: USER_ROLE });
    assert.equal(wrong.status, 400);
    const right = await request('POST', '/user/auth/verify-otp', { body: { email: USER.email, otp: code, type: 'email_varification' }, headers: USER_ROLE });
    assert.equal(right.status, 200);
});

test('sign-in returns access tokens once the email is verified', async () => {
    const res = await request('POST', '/user/auth/login', { body: { email: USER.email, password: USER.password }, headers: USER_ROLE });
    assert.equal(res.status, 200);
    userToken = res.body.data.tokens.access.token;
    assert.ok(userToken);
});

test('the profile needs a token and returns the signed-in user', async () => {
    const anonymous = await request('GET', '/user/profile');
    assert.equal(anonymous.status, 401);
    const me = await request('GET', '/user/profile', { token: userToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, USER.email);
    assert.equal(me.body.data.user_profile.name, USER.name);
});

test('repeated wrong passwords lock the account for a while', async () => {
    const bad = { email: USER.email, password: 'wrong-password-1' };
    let last;
    for (let i = 0; i < 6; i += 1) last = await request('POST', '/user/auth/login', { body: bad, headers: USER_ROLE });
    assert.match(last.body.message, /Too many failed sign-in attempts/);
});

test('admin sign-in works and protects admin-only writes', async () => {
    const res = await request('POST', '/admin/auth/login', { body: { email: superAdmin.email, password: superAdmin.password } });
    assert.equal(res.status, 200);
    const adminToken = res.body.data.token;
    // The admin token opens an admin route.
    const ok = await request('POST', '/faq', { token: adminToken, body: { question: 'Q?', answer: 'A.' } });
    assert.equal(ok.status, 201);
    // A user token does not, and no token does not.
    const asUser = await request('POST', '/faq', { token: userToken, body: { question: 'Q?', answer: 'A.' } });
    assert.equal(asUser.status, 401);
    const none = await request('POST', '/faq', { body: { question: 'Q?', answer: 'A.' } });
    assert.equal(none.status, 401);
});
