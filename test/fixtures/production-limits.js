// Run by infra.test.js in a child process with NODE_ENV=production, the only mode with rate limits. Each phase comes
// from its own client IP (X-Forwarded-For; the app trusts one proxy hop). Prints `RESULT <json>` with the statuses.
const app = require('../../app');
const db = require('../../src/core/db/central.db');
const redis = require('../../src/core/redis/redis');
const { createAdminUser } = require('../../src/shared/identity');
const { Role, Department } = require('../../src/models');

const ADMIN = { name: 'Limit Admin', email: 'limit.admin@test.example', password: 'Passw0rd#Limit1' };

// The statuses of `count` requests made one after another by send(i).
const statuses = async (count, send) => {
    const list = [];
    for (let i = 0; i < count; i += 1) list.push((await send(i)).status);
    return list;
};

(async () => {
    const role = await Role.findOne({ where: { abbreviation: 'ADM' } });
    const dept = await Department.findOne({ order: [['id', 'ASC']] });
    await createAdminUser({ ...ADMIN, role_id: role.id, department_id: dept.id });

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const post = (path, body, ip) => fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body: JSON.stringify(body),
    });

    const result = {
        successes: await statuses(25, () => post('/admin/auth/login', ADMIN, '10.0.0.1')),
        failures: await statuses(21, (i) => post('/admin/auth/login', { email: `nobody${i}@test.example`, password: 'wrong' }, '10.0.0.2')),
        otherIp: (await post('/admin/auth/login', { email: 'nobody@test.example', password: 'wrong' }, '10.0.0.3')).status,
        codes: await statuses(11, (i) => post('/user/auth/otp', { email: `code${i}@test.example`, type: 'email_varification' }, '10.0.0.4')),
        limitedBody: await (await post('/admin/auth/login', { email: 'nobody@test.example', password: 'wrong' }, '10.0.0.2')).json(),
    };
    process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
    server.close();
    await Promise.allSettled([db.close(), redis.quit()]);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
