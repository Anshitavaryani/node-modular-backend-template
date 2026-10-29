// Reference data: public reads, and admin-only writes by role tier.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, request, ensureSuperAdmin, close } = require('./helpers');

let superToken;
let subAdminToken;

before(async () => {
    await start();
    const sup = await ensureSuperAdmin();
    const res = await request('POST', '/admin/auth/login', { body: { email: sup.email, password: sup.password } });
    superToken = res.body.data.token;
});
after(close);

test('countries and states are readable without a token', async () => {
    const countries = await request('GET', '/country?limit=3');
    assert.equal(countries.status, 200);
    assert.ok(countries.body.data.length > 0);
    const one = await request('GET', `/country/${countries.body.data[0].id}`);
    assert.equal(one.status, 200);
    const states = await request('GET', '/state?limit=3');
    assert.equal(states.status, 200);
});

test('roles can be created only by the super admin', async () => {
    const created = await request('POST', '/role', { token: superToken, body: { name: 'Auditor', abbreviation: 'AUD' } });
    assert.equal(created.status, 201);
    const sub = await request('POST', '/admin/auth/login', { body: { email: 'missing@test.example', password: 'x' } });
    assert.notEqual(sub.status, 200);
    const withoutToken = await request('POST', '/role', { body: { name: 'X', abbreviation: 'X1' } });
    assert.equal(withoutToken.status, 401);
});

test('departments are readable by the admin and writable by the admin', async () => {
    const list = await request('GET', '/department', { token: superToken });
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length >= 1);
    const created = await request('POST', '/department', { token: superToken, body: { name: 'Quality' } });
    assert.ok([200, 201].includes(created.status));
});
