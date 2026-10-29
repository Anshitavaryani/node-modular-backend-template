// Contact us: anyone can send a message, and only the admin tier (super admin, admin, sub-admin) can read the list.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, request, ensureSuperAdmin, createAdmin, signInAdmin, close } = require('./helpers');

let adminToken;

before(async () => {
    await start();
    const sup = await ensureSuperAdmin();
    const res = await request('POST', '/admin/auth/login', { body: { email: sup.email, password: sup.password } });
    adminToken = res.body.data.token;
});
after(close);

test('a contact-us message is accepted without a token', async () => {
    const sent = await request('POST', '/contactUs', { body: { email: 'visitor@test.example', address: 'Hello from a visitor', mobile: '9999900002' } });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.success, true);
});

test('the contact-us list is for admins only', async () => {
    const list = await request('GET', '/contactUs', { token: adminToken });
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((m) => m.email === 'visitor@test.example'));
    const anonymous = await request('GET', '/contactUs');
    assert.equal(anonymous.status, 401);
});

test('a contact-us message without a valid email is refused', async () => {
    const res = await request('POST', '/contactUs', { body: { address: 'No email given' } });
    assert.equal(res.status, 400);
    // Over 254 characters is not an email address; over the column's 100 is refused by the database, also as a 400.
    const tooLongForEmail = await request('POST', '/contactUs', { body: { email: `${'a'.repeat(64)}@${'b'.repeat(186)}.com` } });
    assert.equal(tooLongForEmail.status, 400);
    assert.match(tooLongForEmail.body.message, /valid email/);
    const tooLongForColumn = await request('POST', '/contactUs', { body: { email: `${'a'.repeat(64)}@${'b'.repeat(51)}.com` } });
    assert.equal(tooLongForColumn.status, 400);
    assert.deepEqual(tooLongForColumn.body.details, ['email']);
});

test('contact-us messages are closed to admins outside the admin tier', async () => {
    const engineerToken = await signInAdmin(await createAdmin({ name: 'Eli Engineer', email: 'eli.engineer@test.example', password: 'Passw0rd#Eng22', role: 'ENG' }));
    const sent = await request('POST', '/contactUs', { body: { email: 'private@test.example', address: 'Personal details' } });
    const { id } = sent.body.data;
    assert.equal((await request('GET', '/contactUs', { token: engineerToken })).status, 401);
    assert.equal((await request('PUT', `/contactUs/${id}`, { token: engineerToken, body: { address: 'X' } })).status, 401);
    assert.equal((await request('DELETE', `/contactUs/${id}`, { token: engineerToken })).status, 401);
});

test('an admin edits and deletes a contact-us message; nobody else can', async () => {
    const sent = await request('POST', '/contactUs', { body: { email: 'edit.me@test.example', address: 'First draft', mobile: '9999900021' } });
    const { id } = sent.body.data;

    assert.equal((await request('PUT', `/contactUs/${id}`, { body: { address: 'X' } })).status, 401);
    const edited = await request('PUT', `/contactUs/${id}`, { token: adminToken, body: { address: 'Second draft' } });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.address, 'Second draft');
    assert.equal(edited.body.data.email, 'edit.me@test.example');
    assert.equal((await request('PUT', `/contactUs/${id}`, { token: adminToken, body: { email: 'not-an-email' } })).status, 400);
    assert.equal((await request('PUT', '/contactUs/99999999', { token: adminToken, body: { address: 'X' } })).status, 404);

    assert.equal((await request('DELETE', `/contactUs/${id}`)).status, 401);
    assert.equal((await request('DELETE', `/contactUs/${id}`, { token: adminToken })).status, 200);
    const list = await request('GET', '/contactUs', { token: adminToken });
    assert.ok(!list.body.data.some((m) => m.id === id));
    assert.equal((await request('PUT', `/contactUs/${id}`, { token: adminToken, body: { address: 'X' } })).status, 404);
    assert.equal((await request('DELETE', `/contactUs/${id}`, { token: adminToken })).status, 404);
});
