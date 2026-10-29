// Start-up and the shared HTTP behaviour: health, the unknown-route shape, bad request bodies, and config validation.
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

test('a malformed or oversized JSON body is the client\'s error, not a 500', async () => {
    const server = await listen();
    try {
        const { port } = server.address();
        const post = (body) => fetch(`http://127.0.0.1:${port}/api/v1/contactUs/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        const malformed = await post('{"email": "a@test.example",');
        assert.equal(malformed.status, 400);
        assert.deepEqual(await malformed.json(), {
            success: false, status: 400, message: 'The request body is not valid JSON.', data: '',
        });
        const oversized = await post(JSON.stringify({ address: 'x'.repeat(1024 * 1024 + 1) }));
        assert.equal(oversized.status, 413);
        assert.equal((await oversized.json()).message, 'The request body is too large.');
    } finally {
        server.close();
    }
});

test('uploaded files may be loaded by pages on other origins', async () => {
    const server = await listen();
    try {
        const { port } = server.address();
        const res = await fetch(`http://127.0.0.1:${port}/images/missing.png`);
        assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
    } finally {
        server.close();
    }
});

test('CORS lets the allowed origin in, answers its preflight, and refuses other origins', async () => {
    const server = await listen();
    try {
        const base = `http://127.0.0.1:${server.address().port}/api/v1`;
        const preflight = await fetch(`${base}/faq`, {
            method: 'OPTIONS',
            headers: { Origin: 'http://allowed.test.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-access-token,content-type' },
        });
        assert.equal(preflight.status, 200);
        assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://allowed.test.example');
        assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
        assert.match(preflight.headers.get('access-control-allow-headers'), /x-access-token/);
        assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);

        const other = await fetch(`${base}/faq`, { headers: { Origin: 'http://elsewhere.test.example' } });
        assert.equal(other.status, 403);
        assert.equal((await other.json()).code, 'ORIGIN_NOT_ALLOWED');
        // Calls without an Origin header (servers, mobile apps) are not browser cross-origin calls.
        assert.equal((await fetch(`${base}/faq`)).status, 200);
    } finally {
        server.close();
    }
});

test('in production, failed auth requests and code requests are limited per IP', () => {
    // Production checks these settings at start-up; the values only need to be present.
    const env = {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: 'a-production-length-secret-for-the-limit-test',
        API_BASE_URL: 'http://127.0.0.1',
        SMTP_HOST: 'smtp.invalid',
        SMTP_PORT: '587',
        SMTP_USERNAME: 'user',
        SMTP_PASSWORD: 'pass',
        EMAIL_FROM: 'noreply@test.example',
    };
    const child = spawnSync(process.execPath, [path.join(__dirname, 'fixtures', 'production-limits.js')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60000 });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout.split('\n').find((line) => line.startsWith('RESULT ')).slice('RESULT '.length));

    // Successful sign-ins are never counted.
    assert.deepEqual([...new Set(result.successes)], [200]);
    // 20 failures are allowed per IP; the 21st is refused, in the standard error shape. Another IP is not affected.
    assert.deepEqual(result.failures, [...Array(20).fill(400), 429]);
    assert.equal(result.otherIp, 400);
    assert.deepEqual(result.limitedBody, { success: false, status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.', data: '' });
    // Code requests count even when they succeed: 10 per IP.
    assert.deepEqual(result.codes, [...Array(10).fill(200), 429]);
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
