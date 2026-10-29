// Test runner: builds the test database once (migrations and seeds), then runs every test file one after another.
// Works on Node 22 (node --test-global-setup needs Node 24).
const path = require('path');
const { spawnSync } = require('child_process');
const { globalSetup } = require('./setup');

(async () => {
    await globalSetup();
    const files = require('fs').readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).toSorted().map((f) => path.join(__dirname, f));
    const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit', env: process.env });
    process.exit(result.status ?? 1);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
