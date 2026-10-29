// Start-up and the shared HTTP behaviour: health, the unknown-route shape, and config validation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('./env');
const app = require('../app');
const db = require('../src/core/db/central.db');
const redis = require('../src/core/redis/redis');
const redisConnection = require('../src/core/redis/connection');

const ROOT = path.join(__dirname, '..');

const listen = () => new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
});

test('health check reports the database and Redis as up', async () => {
    const server = await listen();
    try {
        const { port } = server.address();
        const res = await fetch(`http://127.0.0.1:${port}/api/healthcheck`);
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.response, 'ok');
        assert.deepEqual(body.checks, { database: true, redis: true });
    } finally {
        server.close();
    }
});

test('an unknown route answers 404 in the standard error shape', async () => {
    const server = await listen();
    try {
        const { port } = server.address();
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/does-not-exist`);
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.success, false);
        assert.equal(body.status, 404);
        assert.equal(typeof body.message, 'string');
    } finally {
        server.close();
    }
});

test('start-up refuses a config with a missing required variable', () => {
    const env = { ...process.env };
    env.JWT_SECRET = ''; // set but empty: counts as unset, and .env cannot refill it
    const result = spawnSync(process.execPath, ['-e', "require('./src/core/config/config')"], { cwd: ROOT, env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing .*JWT_SECRET/);
});

test('redis answers PING through the shared client', async () => {
    assert.equal(await redisConnection.isHealthy(), true);
});

test.after(async () => {
    await Promise.allSettled([db.close(), redis.quit()]);
});
