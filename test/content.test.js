// Content, contact and billing: FAQ, contact-us submissions, and the Stripe entry points.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, request, ensureSuperAdmin, close } = require('./helpers');

let adminToken;

before(async () => {
    await start();
    const sup = await ensureSuperAdmin();
    const res = await request('POST', '/admin/auth/login', { body: { email: sup.email, password: sup.password } });
    adminToken = res.body.data.token;
});
after(close);

test('FAQ entries are created by an admin and listed publicly', async () => {
    const created = await request('POST', '/faq', { token: adminToken, body: { question: 'What does this service do?', answer: 'A sample answer.' } });
    assert.equal(created.status, 201);
    const list = await request('GET', '/faq');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((f) => f.question === 'What does this service do?'));
});

test('a contact-us message is accepted publicly and listed for admins only', async () => {
    const sent = await request('POST', '/contactUs', { body: { name: 'Visitor', email: 'visitor@test.example', message: 'Hello' } });
    assert.equal(sent.status, 201);
    const list = await request('GET', '/contactUs', { token: adminToken });
    assert.equal(list.status, 200);
    const anonymous = await request('GET', '/contactUs');
    assert.equal(anonymous.status, 401);
});

test('Stripe key and payment intent need a signed-in user', async () => {
    const key = await request('GET', '/payment/stripe/stripe-key');
    assert.equal(key.status, 401);
    const intent = await request('POST', '/payment/stripe/create-payment-intent', { body: {} });
    assert.equal(intent.status, 401);
});

test('a Stripe webhook with a bad signature is refused', async () => {
    const res = await request('POST', '/payment/stripe/charge-intent/webhooks', {
        body: { id: 'evt_test', type: 'payment_intent.succeeded' },
        headers: { 'stripe-signature': 't=1,v1=bad' },
    });
    assert.equal(res.status, 400);
});

test('payment totals are admin-only', async () => {
    const anonymous = await request('GET', '/payment/count');
    assert.equal(anonymous.status, 401);
    const count = await request('GET', '/payment/count', { token: adminToken });
    assert.equal(count.status, 200);
});
