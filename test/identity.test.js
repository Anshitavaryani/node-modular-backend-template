// Accounts: registration, one-time codes, sign-in and lockout, profile, notifications, logout, password changes and
// resets, deactivation, and admin accounts.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, apiUrl, request, ensureSuperAdmin, latestCode, createAdmin, signInAdmin, signUpUser, close } = require('./helpers');
const { UPLOADS_DIR } = require('../src/core/config/paths');
const redis = require('../src/core/redis/redis');
const { Admin, User, UserLoginTiming, Role } = require('../src/models');

const USER = { name: 'Ann Test', email: 'ann.identity@test.example', mobile: '9999900001', password: 'Passw0rd12', confirm_password: 'Passw0rd12' };
const USER_ROLE = { role_id: process.env.USR_ROLE_ID };
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
    assert.equal(typeof res.body.data.id, 'number', 'ids are numbers, as the starter returned them');
});

test('sign-in records the login time in UTC and in the time zone the client sends', async () => {
    const user = { name: 'Kai Zone', email: 'kai.zone@test.example', mobile: '9999900015', password: 'Passw0rd12' };
    await signUpUser(user);
    const res = await request('POST', '/user/auth/login', { body: { email: user.email, password: user.password }, headers: { timezone: 'Asia/Kolkata' } });
    assert.equal(res.status, 200);
    const timing = await UserLoginTiming.findOne({ where: { user_id: res.body.data.id }, order: [['id', 'DESC']] });
    assert.ok(timing, 'a login timing was recorded');
    // Kolkata is UTC+5:30 all year, whatever the time zone of the machine running the tests.
    assert.equal(timing.login_time_local - timing.login_time_utc, 330 * 60 * 1000);
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
    assert.equal(res.body.message, 'Successfully Logged in.');
    const adminToken = res.body.data.token;
    // The admin token opens an admin route (the contact-us list).
    const ok = await request('GET', '/contactUs', { token: adminToken });
    assert.equal(ok.status, 200);
    // A user token does not, and no token does not.
    const asUser = await request('GET', '/contactUs', { token: userToken });
    assert.equal(asUser.status, 401);
    const none = await request('GET', '/contactUs');
    assert.equal(none.status, 401);
});

test('a super admin creates an admin; an ordinary admin cannot', async () => {
    const sign = await request('POST', '/admin/auth/login', { body: { email: superAdmin.email, password: superAdmin.password } });
    const superToken = sign.body.data.token;
    // The Admin role is one a project creates from the admin panel (the test setup adds it); department 1 is seeded.
    const adminTier = { role_id: (await Role.findOne({ where: { abbreviation: 'ADM' } })).id, department_id: 1 };
    const created = await request('POST', '/admin/auth/register', {
        token: superToken,
        body: { name: 'Ops Admin', email: 'ops.admin@test.example', password: 'Passw0rd#Ops1', confirm_password: 'Passw0rd#Ops1', ...adminTier },
    });
    assert.equal(created.status, 201);
    assert.equal(typeof created.body.data.id, 'number', 'a new row\'s id is a number, not a BigInt');
    const weak = await request('POST', '/admin/auth/register', {
        token: superToken,
        body: { name: 'Weak', email: 'weak.admin@test.example', password: 'weakpass1', confirm_password: 'weakpass1', ...adminTier },
    });
    assert.equal(weak.status, 400);
    const opsSign = await request('POST', '/admin/auth/login', { body: { email: 'ops.admin@test.example', password: 'Passw0rd#Ops1' } });
    assert.equal(opsSign.status, 200);
    const denied = await request('POST', '/admin/auth/register', {
        token: opsSign.body.data.token,
        body: { name: 'Second', email: 'second.admin@test.example', password: 'Passw0rd#Two11', confirm_password: 'Passw0rd#Two11', ...adminTier },
    });
    assert.equal(denied.status, 401);
});

test('an admin changes their password only with the right old one', async () => {
    const admin = await createAdmin({ name: 'Pat Change', email: 'pat.change@test.example', password: 'Passw0rd#Old11', role: 'ADM' });
    const token = await signInAdmin(admin);
    const NEW = 'Passw0rd#New22';
    const change = (body, withToken = token) => request('POST', '/admin/auth/change-password', { token: withToken, body });

    assert.equal((await change({ old_password: admin.password })).status, 400);
    assert.equal((await change({ old_password: admin.password, new_password: NEW, confirm_password: 'Passw0rd#Other3' })).status, 400);
    const wrongOld = await change({ old_password: 'Wrong#Passw0rd1', new_password: NEW, confirm_password: NEW });
    assert.equal(wrongOld.status, 400);
    assert.match(wrongOld.body.message, /Incorrect Old Password/);
    assert.equal((await change({ old_password: admin.password, new_password: NEW, confirm_password: NEW }, null)).status, 401);
    assert.equal((await change({ old_password: admin.password, new_password: 'weakpass1', confirm_password: 'weakpass1' })).status, 400);

    const changed = await change({ old_password: admin.password, new_password: NEW, confirm_password: NEW });
    assert.equal(changed.status, 200);
    // Every session signed in with the old password ends.
    assert.equal((await request('GET', '/contactUs', { token })).status, 401);
    const oldSignIn = await request('POST', '/admin/auth/login', { body: { email: admin.email, password: admin.password } });
    assert.equal(oldSignIn.status, 400);
    const newToken = await signInAdmin({ email: admin.email, password: NEW });
    assert.equal((await request('GET', '/contactUs', { token: newToken })).status, 200);
});

test('an admin who forgot their password resets it with an emailed code', async () => {
    const admin = await createAdmin({ name: 'Rae Forgot', email: 'rae.forgot@test.example', password: 'Passw0rd#Old11', role: 'ADM' });
    const NEW = 'Passw0rd#New33';
    const verify = (otp) => request('POST', '/admin/auth/verify-otp', { body: { email: admin.email, otp, otp_type: 'forgot_password' } });
    const reset = (body) => request('POST', '/admin/auth/forgot-password', { body: { email: admin.email, ...body } });

    const signedIn = await signInAdmin(admin);
    assert.equal((await request('POST', '/admin/auth/otp', { body: {} })).status, 400);
    // An email that is not an admin's gets the same answer, so the form does not tell who is an admin.
    const unknown = await request('POST', '/admin/auth/otp', { body: { email: 'nobody.admin@test.example' } });
    assert.equal(unknown.status, 200);
    const unknownVerify = await request('POST', '/admin/auth/verify-otp', { body: { email: 'nobody.admin@test.example', otp: '123456' } });
    assert.equal(unknownVerify.status, 400);
    assert.equal((await request('POST', '/admin/auth/otp', { body: { email: admin.email } })).status, 200);
    const again = await request('POST', '/admin/auth/otp', { body: { email: admin.email } });
    assert.equal(again.status, 429);

    const { otp } = await Admin.findOne({ where: { email: admin.email } });
    assert.equal((await verify(otp === '000000' ? '111111' : '000000')).status, 400);
    const verified = await verify(otp);
    assert.equal(verified.status, 200);
    const resetToken = verified.body.data.token;
    assert.ok(resetToken);
    // The code is spent once used, and the reset token does not open admin routes.
    assert.equal((await verify(otp)).status, 400);
    assert.equal((await request('GET', '/contactUs', { token: resetToken })).status, 401);

    assert.equal((await reset({ password: NEW, confirm_password: NEW, token: 'not-the-token' })).status, 400);
    assert.equal((await reset({ password: NEW, confirm_password: 'Passw0rd#Other4', token: resetToken })).status, 400);
    assert.equal((await reset({ password: 'weakpass1', confirm_password: 'weakpass1', token: resetToken })).status, 400);
    assert.equal((await reset({ password: NEW, confirm_password: NEW, token: resetToken })).status, 200);
    // A session from before the reset ends; the new password signs in.
    assert.equal((await request('GET', '/contactUs', { token: signedIn })).status, 401);
    await signInAdmin({ email: admin.email, password: NEW });
    // The token is cleared once used.
    assert.equal((await reset({ password: 'Passw0rd#Again5', confirm_password: 'Passw0rd#Again5', token: resetToken })).status, 400);
});

test('notifications switch off and on for the signed-in user', async () => {
    const token = await signUpUser({ name: 'Nia Notify', email: 'nia.notify@test.example', mobile: '9999900011', password: 'Passw0rd12' });
    assert.equal((await request('POST', '/user/notifications')).status, 401);

    const off = await request('POST', '/user/notifications', { token });
    assert.equal(off.status, 200);
    assert.match(off.body.message, /turned Off/);
    assert.equal((await request('GET', '/user/profile', { token })).body.data.notification_status, false);

    const on = await request('POST', '/user/notifications', { token });
    assert.match(on.body.message, /turned On/);
    assert.equal((await request('GET', '/user/profile', { token })).body.data.notification_status, true);
});

test('logout ends the session behind the token', async () => {
    const token = await signUpUser({ name: 'Leo Logout', email: 'leo.logout@test.example', mobile: '9999900012', password: 'Passw0rd12' });
    const out = await request('GET', '/user/auth/logout', { token });
    assert.equal(out.status, 200);
    assert.equal((await request('GET', '/user/profile', { token })).status, 401);
});

test('a signed-in user changes their password and the old session ends', async () => {
    const user = { name: 'Rita Reset', email: 'rita.reset@test.example', mobile: '9999900013', password: 'Passw0rd12' };
    const token = await signUpUser(user);
    const NEW = 'NewPassw0rd34';
    const change = (body) => request('POST', '/user/auth/reset-password', { token, body });

    assert.equal((await change({ old_password: user.password })).status, 400);
    assert.equal((await change({ old_password: user.password, new_password: 'short1', confirm_password: 'short1' })).status, 400);
    const wrongOld = await change({ old_password: 'Wrong0ld99', new_password: NEW, confirm_password: NEW });
    assert.equal(wrongOld.status, 400);
    assert.match(wrongOld.body.message, /Incorrect Old Password/);

    const changed = await change({ old_password: user.password, new_password: NEW, confirm_password: NEW });
    assert.equal(changed.status, 200);
    const newToken = changed.body.data.tokens.access.token;
    assert.equal(changed.body.data.tokens.access.id, undefined);
    assert.equal((await request('GET', '/user/profile', { token })).status, 401);
    assert.equal((await request('GET', '/user/profile', { token: newToken })).status, 200);
    const signIn = await request('POST', '/user/auth/login', { body: { email: user.email, password: NEW } });
    assert.equal(signIn.status, 200);
});

test('a user who forgot their password resets it with an emailed code', async () => {
    const user = { name: 'Finn Forgot', email: 'finn.forgot@test.example', mobile: '9999900014', password: 'Passw0rd12' };
    await signUpUser(user);
    // Registration started the 60 s resend cooldown for this email; end it instead of waiting.
    await redis.del(`otp:cooldown:${user.email}`);
    const NEW = 'NewPassw0rd56';
    const reset = (body) => request('POST', '/user/auth/forgot-password', { body: { email: user.email, ...body } });

    assert.equal((await request('POST', '/user/auth/otp', { body: { email: user.email, type: 'forgot_password' } })).status, 200);
    const otp = await latestCode(user.email, 'forgot_password');
    const verified = await request('POST', '/user/auth/verify-otp', { body: { email: user.email, otp, type: 'forgot_password' } });
    assert.equal(verified.status, 200);
    const { token } = verified.body.data;
    assert.ok(token);

    assert.equal((await reset({ password: NEW, token })).status, 400);
    assert.equal((await reset({ password: 'weakpass1', confirm_password: 'weakpass1', token })).status, 400);
    assert.equal((await reset({ password: NEW, confirm_password: NEW, token: 'not-the-token' })).status, 400);
    assert.equal((await reset({ password: NEW, confirm_password: NEW, token })).status, 200);
    const signIn = await request('POST', '/user/auth/login', { body: { email: user.email, password: NEW } });
    assert.equal(signIn.status, 200);
    // The token is spent once used.
    assert.equal((await reset({ password: 'Passw0rd78', confirm_password: 'Passw0rd78', token })).status, 400);
});

test('a deactivated account can no longer use its token or sign in', async () => {
    const user = { name: 'Dee Deactivate', email: 'dee.deactivate@test.example', mobile: '9999900015', password: 'Passw0rd12' };
    const token = await signUpUser(user);
    assert.equal((await request('DELETE', '/user/deactivate')).status, 401);

    const gone = await request('DELETE', '/user/deactivate', { token });
    assert.equal(gone.status, 200);
    assert.equal((await request('GET', '/user/profile', { token })).status, 401);
    const signIn = await request('POST', '/user/auth/login', { body: { email: user.email, password: user.password } });
    assert.equal(signIn.status, 400);
    // The email is free again for a new account.
    const again = await request('POST', '/user/auth/register', { body: { ...user, confirm_password: user.password } });
    assert.equal(again.status, 201);
});

test('two registrations with one email at the same moment make one account', async () => {
    const user = { name: 'Ray Race', email: 'ray.race@test.example', mobile: '9999900016', password: 'Passw0rd12', confirm_password: 'Passw0rd12' };
    // Both requests pass the "email taken" check before either is stored; the database's unique key refuses the second.
    const results = await Promise.all([1, 2].map(() => request('POST', '/user/auth/register', { body: user })));
    assert.deepEqual(results.map((r) => r.status).toSorted(), [201, 400]);
    assert.equal(await User.count({ where: { email: user.email } }), 1);
});

// Registers with one file in the given upload field, and passwords that do not match (refused by validation, after
// the file was stored).
const send = (field) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ name: 'Up Load', email: 'up.load@test.example', mobile: '9999900017', password: 'Passw0rd12', confirm_password: 'Passw0rd34' })) {
        form.append(key, value);
    }
    form.append(field, new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'photo.png');
    return fetch(`${apiUrl()}/user/auth/register`, { method: 'POST', body: form });
};

test('a registration that fails keeps none of its files, and a bad upload field is a 400', async () => {
    const imagesDir = path.join(UPLOADS_DIR, 'images');
    const stored = fs.readdirSync(imagesDir).length;
    const refused = await send('images');
    assert.equal(refused.status, 400);
    // The file is removed once the response is sent.
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(fs.readdirSync(imagesDir).length, stored);

    const badField = await send('avatar');
    assert.equal(badField.status, 400);
    assert.equal((await badField.json()).code, 'LIMIT_UNEXPECTED_FILE');
});
