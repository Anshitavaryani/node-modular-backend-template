// Reference data: public reads, and admin-only writes by role tier.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, request, ensureSuperAdmin, createAdmin, signInAdmin, close } = require('./helpers');

let superToken;
let subAdminToken;
let engineerToken;

before(async () => {
    await start();
    superToken = await signInAdmin(await ensureSuperAdmin());
    // Departments are open to the super admin, admin and sub-admin tiers; roles to the super admin only.
    subAdminToken = await signInAdmin(await createAdmin({ name: 'Sub Reference', email: 'sub.reference@test.example', password: 'Passw0rd#Sub11', role: 'SUB_ADM' }));
    engineerToken = await signInAdmin(await createAdmin({ name: 'Eng Reference', email: 'eng.reference@test.example', password: 'Passw0rd#Eng11', role: 'ENG' }));
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

test('list pages are capped, and a limit below 1 gives the default page', async () => {
    const huge = await request('GET', '/city?limit=200000');
    assert.equal(huge.status, 200);
    assert.equal(huge.body.data.length, 1000);
    const negative = await request('GET', '/city?limit=-5');
    assert.equal(negative.status, 200);
    assert.equal(negative.body.data.length, 15);
});

test('a city and its state are readable one at a time, with their parents', async () => {
    const cities = await request('GET', '/city?limit=1');
    assert.equal(cities.status, 200);
    const city = await request('GET', `/city/${cities.body.data[0].id}`);
    assert.equal(city.status, 200);
    assert.equal(city.body.data.state.id, city.body.data.state_id);
    assert.equal(city.body.data.country.id, city.body.data.country_id);

    const state = await request('GET', `/state/${city.body.data.state_id}`);
    assert.equal(state.status, 200);
    assert.ok(state.body.data.country.id);
    assert.ok(state.body.data.all_city.some((c) => c.id === city.body.data.id));

    assert.equal((await request('GET', '/state/99999999')).status, 404);
    assert.equal((await request('GET', '/city/99999999')).status, 404);
});

test('roles can be created only by the super admin', async () => {
    const created = await request('POST', '/role', { token: superToken, body: { name: 'Auditor', abbreviation: 'AUD' } });
    assert.equal(created.status, 201);
    const bySubAdmin = await request('POST', '/role', { token: subAdminToken, body: { name: 'X', abbreviation: 'X1' } });
    assert.equal(bySubAdmin.status, 401);
    const withoutToken = await request('POST', '/role', { body: { name: 'X', abbreviation: 'X1' } });
    assert.equal(withoutToken.status, 401);
    assert.equal((await request('POST', '/role', { token: superToken, body: { name: 'No Abbreviation' } })).status, 400);
});

test('the super admin reads, renames and deletes a role', async () => {
    await request('POST', '/role', { token: superToken, body: { name: 'Reviewer', abbreviation: 'REV' } });
    const list = await request('GET', '/role', { token: superToken });
    assert.equal(list.status, 200);
    const { id } = list.body.data.find((r) => r.abbreviation === 'REV');
    assert.equal((await request('GET', `/role/${id}`, { token: superToken })).status, 200);
    assert.equal((await request('GET', '/role', { token: subAdminToken })).status, 401);

    // Name and abbreviation change together.
    const half = await request('PUT', `/role/${id}`, { token: superToken, body: { name: 'Only Name' } });
    assert.equal(half.status, 400);
    const renamed = await request('PUT', `/role/${id}`, { token: superToken, body: { name: 'Senior Reviewer', abbreviation: 'SREV' } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.name, 'Senior Reviewer');
    assert.equal(renamed.body.data.abbreviation, 'SREV');
    assert.equal((await request('PUT', `/role/${id}`, { token: subAdminToken, body: { name: 'N', abbreviation: 'N' } })).status, 401);

    assert.equal((await request('DELETE', `/role/${id}`, { token: subAdminToken })).status, 401);
    assert.equal((await request('DELETE', `/role/${id}`, { token: superToken })).status, 200);
    assert.equal((await request('GET', `/role/${id}`, { token: superToken })).status, 404);
    assert.equal((await request('PUT', `/role/${id}`, { token: superToken, body: { name: 'N', abbreviation: 'N' } })).status, 404);
    assert.equal((await request('DELETE', `/role/${id}`, { token: superToken })).status, 404);
});

test('departments are open to the admin tiers and closed to other admins', async () => {
    const list = await request('GET', '/department', { token: superToken });
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length >= 1);
    const created = await request('POST', '/department', { token: superToken, body: { name: 'Quality' } });
    assert.equal(created.status, 201);
    assert.equal((await request('POST', '/department', { token: superToken, body: {} })).status, 400);
    assert.equal((await request('GET', '/department', { token: subAdminToken })).status, 200);
    assert.equal((await request('GET', '/department', { token: engineerToken })).status, 401);
    assert.equal((await request('GET', '/department')).status, 401);
});

test('an admin reads, renames and deletes a department', async () => {
    const created = await request('POST', '/department', { token: subAdminToken, body: { name: 'Logistics' } });
    assert.equal(created.status, 201);
    const { id } = created.body.data;
    assert.equal((await request('GET', `/department/${id}`, { token: subAdminToken })).status, 200);

    const renamed = await request('PUT', `/department/${id}`, { token: subAdminToken, body: { name: 'Supply Chain' } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.name, 'Supply Chain');
    assert.equal((await request('PUT', `/department/${id}`, { token: engineerToken, body: { name: 'X' } })).status, 401);

    assert.equal((await request('DELETE', `/department/${id}`, { token: engineerToken })).status, 401);
    assert.equal((await request('DELETE', `/department/${id}`, { token: subAdminToken })).status, 200);
    assert.equal((await request('GET', `/department/${id}`, { token: subAdminToken })).status, 404);
    const list = await request('GET', '/department', { token: subAdminToken });
    assert.ok(!list.body.data.some((d) => d.id === id));
    assert.equal((await request('PUT', `/department/${id}`, { token: subAdminToken, body: { name: 'X' } })).status, 404);
    assert.equal((await request('DELETE', `/department/${id}`, { token: subAdminToken })).status, 404);
});
