// Content: the FAQ is public to read and changed only by admins in the editor tier.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, request, ensureSuperAdmin, createAdmin, signInAdmin, close } = require('./helpers');

let adminToken;

before(async () => {
    await start();
    adminToken = await signInAdmin(await ensureSuperAdmin());
});
after(close);

test('FAQ entries are created by an admin and listed publicly', async () => {
    const created = await request('POST', '/faq', { token: adminToken, body: { question: 'What does this service do?', answer: 'A sample answer.' } });
    assert.equal(created.status, 201);
    const list = await request('GET', '/faq');
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((f) => f.question === 'What does this service do?'));
    const anonymous = await request('POST', '/faq', { body: { question: 'Q?', answer: 'A.' } });
    assert.equal(anonymous.status, 401);
    // Both fields are required.
    const empty = await request('POST', '/faq', { token: adminToken, body: { question: '  ' } });
    assert.equal(empty.status, 400);
    assert.match(empty.body.message, /question, answer/);
});

test('an admin edits and deletes a FAQ entry; nobody else can', async () => {
    const created = await request('POST', '/faq', { token: adminToken, body: { question: 'How do I reset my password?', answer: 'Ask support.' } });
    const { id } = created.body.data;
    const ANSWER = 'Request a code by email, then choose a new password.';

    assert.equal((await request('PUT', `/faq/${id}`, { body: { answer: 'X' } })).status, 401);
    const edited = await request('PUT', `/faq/${id}`, { token: adminToken, body: { answer: ANSWER } });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.answer, ANSWER);
    assert.equal(edited.body.data.question, 'How do I reset my password?');
    // Saving the same text again is still a success, not "not found".
    assert.equal((await request('PUT', `/faq/${id}`, { token: adminToken, body: { answer: ANSWER } })).status, 200);
    assert.equal((await request('PUT', '/faq/99999999', { token: adminToken, body: { answer: 'X' } })).status, 404);

    assert.equal((await request('DELETE', `/faq/${id}`)).status, 401);
    assert.equal((await request('DELETE', `/faq/${id}`, { token: adminToken })).status, 200);
    const list = await request('GET', '/faq');
    assert.ok(!list.body.data.some((f) => f.id === id));
    assert.equal((await request('PUT', `/faq/${id}`, { token: adminToken, body: { answer: 'X' } })).status, 404);
    assert.equal((await request('DELETE', `/faq/${id}`, { token: adminToken })).status, 404);
});

test('FAQ edits are for the editor tier of admins', async () => {
    const editorToken = await signInAdmin(await createAdmin({ name: 'Edie Editor', email: 'edie.editor@test.example', password: 'Passw0rd#Edit1', role: 'EDTR' }));
    // An admin account can be given any role but super admin; one outside the editor tier may not edit.
    const outsiderToken = await signInAdmin(await createAdmin({ name: 'Uma Outsider', email: 'uma.outsider@test.example', password: 'Passw0rd#Out11', role: 'USR' }));

    const created = await request('POST', '/faq', { token: editorToken, body: { question: 'Who edits this?', answer: 'Editors.' } });
    assert.equal(created.status, 201);
    const { id } = created.body.data;
    assert.equal((await request('POST', '/faq', { token: outsiderToken, body: { question: 'Q?', answer: 'A.' } })).status, 401);
    assert.equal((await request('PUT', `/faq/${id}`, { token: outsiderToken, body: { answer: 'X' } })).status, 401);
    assert.equal((await request('DELETE', `/faq/${id}`, { token: outsiderToken })).status, 401);
    assert.equal((await request('DELETE', `/faq/${id}`, { token: editorToken })).status, 200);
});
