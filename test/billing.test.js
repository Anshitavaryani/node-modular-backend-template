// Billing: the Stripe key and payment intents for a signed-in user, the signed webhook, and the admin payment totals.
// Stripe is never called: the client's customers and paymentIntents are replaced by a fake that records what it was
// sent. Webhook signatures use the real library.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('./env');

// Installed before the app loads, so the billing service's require('stripe') gets the fake.
const RealStripe = require('stripe');
const stripeCalls = [];
class FakeStripe extends RealStripe {
    constructor(...args) {
        super(...args);
        this.customers = {
            create: async (params) => {
                stripeCalls.push({ call: 'customers.create', params });
                return { id: `cus_fake_${stripeCalls.length}` };
            },
            retrieve: async (id) => {
                stripeCalls.push({ call: 'customers.retrieve', params: id });
                return { id };
            },
        };
        this.paymentIntents = {
            create: async (params) => {
                stripeCalls.push({ call: 'paymentIntents.create', params });
                return { id: `pi_fake_${stripeCalls.length}`, client_secret: `pi_fake_${stripeCalls.length}_secret` };
            },
        };
    }
}
require.cache[require.resolve('stripe')].exports = FakeStripe;

const { start, request, ensureSuperAdmin, createAdmin, signInAdmin, signUpUser, close } = require('./helpers');
const { Payment, User } = require('../src/models');

const PAYER = { name: 'Pay Person', email: 'pay.person@test.example', mobile: '9999900031', password: 'Passw0rd12' };
const callsTo = (name) => stripeCalls.filter((c) => c.call === name);
let adminToken;
let userToken;

// Today's successful payments as the admin sees them: how many, and the total in cents.
const totals = async () => ({
    count: (await request('GET', '/payment/count', { token: adminToken })).body.data,
    sum: (await request('GET', '/payment/sum', { token: adminToken })).body.data,
});

before(async () => {
    await start();
    adminToken = await signInAdmin(await ensureSuperAdmin());
    userToken = await signUpUser(PAYER);
});
after(close);

test('Stripe key and payment intent need a signed-in user', async () => {
    const key = await request('GET', '/payment/stripe/stripe-key');
    assert.equal(key.status, 401);
    const intent = await request('POST', '/payment/stripe/create-payment-intent', { body: {} });
    assert.equal(intent.status, 401);
});

test('a signed-in user gets the publishable key', async () => {
    const res = await request('GET', '/payment/stripe/stripe-key', { token: userToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.publishable_key, 'pk_test_placeholder');
});

test('a payment intent creates the Stripe customer once and records a pending payment', async () => {
    const first = await request('POST', '/payment/stripe/create-payment-intent', {
        token: userToken,
        body: { amount: 12, currency: 'EUR', description: 'Plan upgrade' },
    });
    assert.equal(first.status, 200);
    const { clientSecret, customer, publishableKey } = first.body.data;
    assert.ok(clientSecret);
    assert.equal(publishableKey, 'pk_test_placeholder');
    assert.equal(callsTo('customers.create').length, 1);
    assert.equal(callsTo('customers.create')[0].params.email, PAYER.email);

    // Amounts are whole units in the request and cents at Stripe and in the payments row. With no payment method named,
    // Stripe offers the ones switched on in its dashboard.
    const intent = callsTo('paymentIntents.create')[0].params;
    assert.equal(intent.amount, 1200);
    assert.equal(intent.currency, 'eur');
    assert.equal(intent.customer, customer);
    assert.deepEqual(intent.automatic_payment_methods, { enabled: true });
    assert.equal(intent.payment_method_types, undefined);
    const payment = await Payment.findOne({ where: { stripe_customer_id: customer }, order: [['id', 'DESC']] });
    assert.equal(payment.amount, 1200);
    assert.equal(payment.currency, 'EUR');
    assert.equal(payment.description, 'Plan upgrade');
    assert.equal(payment.payment_status, 'PENDING');
    assert.equal((await User.findOne({ where: { email: PAYER.email } })).stripe_customer_id, customer);

    // A second payment reuses the stored customer, and falls back to the default amount and USD.
    const second = await request('POST', '/payment/stripe/create-payment-intent', { token: userToken, body: {} });
    assert.equal(second.status, 200);
    assert.equal(second.body.data.customer, customer);
    assert.equal(callsTo('customers.create').length, 1);
    assert.equal(callsTo('customers.retrieve').length, 1);
    const defaults = callsTo('paymentIntents.create')[1].params;
    assert.equal(defaults.amount, 500);
    assert.equal(defaults.currency, 'usd');

    // A named method is passed as asked; OMR has three decimals.
    const omr = await request('POST', '/payment/stripe/create-payment-intent', { token: userToken, body: { amount: 3, currency: 'omr', paymentMethod: 'card' } });
    assert.equal(omr.status, 200);
    const named = callsTo('paymentIntents.create')[2].params;
    assert.deepEqual(named.payment_method_types, ['card']);
    assert.equal(named.automatic_payment_methods, undefined);
    assert.equal(named.amount, 3000);
    assert.equal(named.currency, 'omr');
});

test('a payment intent with a bad amount or currency is refused before Stripe is called', async () => {
    const callsBefore = stripeCalls.length;
    for (const body of [{ amount: 0 }, { amount: -5 }, { amount: 2.5 }, { amount: 'ten' }, { amount: 10, currency: 'GBP' }]) {
        const res = await request('POST', '/payment/stripe/create-payment-intent', { token: userToken, body });
        assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(stripeCalls.length, callsBefore);
});

// Posts an event signed with the endpoint secret. request() sends JSON.stringify(body), the exact bytes signed here.
const sendEvent = (event) => request('POST', '/payment/stripe/charge-intent/webhooks', {
    body: event,
    headers: { 'stripe-signature': RealStripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(event), secret: process.env.STRIPE_WEBHOOK_SECRET }) },
});

// A payment's current status, by its payment intent.
const status = async (transaction_id) => (await Payment.findOne({ where: { transaction_id } })).payment_status;

// Webhook events as Stripe sends them: a payment intent event, and a charge refund (full or partial).
const intentEvent = (type, id) => ({ id: `evt_${type}_${id}`, object: 'event', type, data: { object: { id, object: 'payment_intent' } } });
const refundEvent = (id, refunded) => ({
    id: `evt_refund_${id}_${refunded}`, object: 'event', type: 'charge.refunded',
    data: { object: { id: `ch_${id}`, object: 'charge', payment_intent: id, refunded } },
});

test('a Stripe webhook signed with the endpoint secret is accepted', async () => {
    const res = await sendEvent({ id: 'evt_test_ok', object: 'event', type: 'customer.created', data: { object: { id: 'cus_any' } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.received, true);
});

test('Stripe webhooks move a payment through its statuses, and a late event never undoes a newer one', async () => {
    const { id: user_id } = await User.findOne({ where: { email: PAYER.email } });
    const make = (transaction_id) => Payment.create({ transaction_id, amount: 1000, user_id, stripe_customer_id: 'cus_hooks' });

    await make('pi_hook_ok');
    assert.equal((await sendEvent(intentEvent('payment_intent.succeeded', 'pi_hook_ok'))).status, 200);
    assert.equal(await status('pi_hook_ok'), 'SUCCESS');
    await sendEvent(intentEvent('payment_intent.payment_failed', 'pi_hook_ok'));
    assert.equal(await status('pi_hook_ok'), 'SUCCESS');
    await sendEvent(refundEvent('pi_hook_ok', false));
    assert.equal(await status('pi_hook_ok'), 'SUCCESS', 'a partial refund leaves the payment as it is');
    await sendEvent(refundEvent('pi_hook_ok', true));
    assert.equal(await status('pi_hook_ok'), 'REFUNDED');

    await make('pi_hook_retry');
    await sendEvent(intentEvent('payment_intent.payment_failed', 'pi_hook_retry'));
    assert.equal(await status('pi_hook_retry'), 'REJECTED');
    await sendEvent(intentEvent('payment_intent.succeeded', 'pi_hook_retry'));
    assert.equal(await status('pi_hook_retry'), 'SUCCESS', 'a retry that succeeds wins');

    await make('pi_hook_cancel');
    await sendEvent(intentEvent('payment_intent.canceled', 'pi_hook_cancel'));
    assert.equal(await status('pi_hook_cancel'), 'REJECTED');
});

test('a Stripe webhook with a bad signature is refused', async () => {
    const res = await request('POST', '/payment/stripe/charge-intent/webhooks', {
        body: { id: 'evt_test', type: 'payment_intent.succeeded' },
        headers: { 'stripe-signature': 't=1,v1=bad' },
    });
    assert.equal(res.status, 400);
});

test('payment totals are for the admin tier only', async () => {
    const anonymous = await request('GET', '/payment/count');
    assert.equal(anonymous.status, 401);
    const asUser = await request('GET', '/payment/sum', { token: userToken });
    assert.equal(asUser.status, 401);
    const count = await request('GET', '/payment/count', { token: adminToken });
    assert.equal(count.status, 200);
    const engineerToken = await signInAdmin(await createAdmin({ name: 'Ezra Engineer', email: 'ezra.engineer@test.example', password: 'Passw0rd#Eng33', role: 'ENG' }));
    assert.equal((await request('GET', '/payment/count', { token: engineerToken })).status, 401);
    assert.equal((await request('GET', '/payment/sum', { token: engineerToken })).status, 401);
});

test('payment totals count only successful payments made today', async () => {
    const earlier = await totals();
    const { id: user_id } = await User.findOne({ where: { email: PAYER.email } });
    const row = (transaction_id, amount, payment_status, extra = {}) =>
        Payment.create({ transaction_id, amount, payment_status, user_id, stripe_customer_id: 'cus_totals', ...extra });
    await row('pi_totals_1', 1500, 'SUCCESS');
    await row('pi_totals_2', 2500, 'SUCCESS');
    await row('pi_totals_3', 9900, 'PENDING');
    await row('pi_totals_4', 7700, 'SUCCESS', { created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });

    const later = await totals();
    assert.equal(later.count - earlier.count, 2);
    assert.equal(later.sum - earlier.sum, 4000);
});
