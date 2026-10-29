// Test environment. Required first by the setup and every test helper, before anything reads the config. Variables
// set here win over .env, so the tests always use the test database and run in test mode.
const os = require('os');
const path = require('path');

const TEST_DATABASE = process.env.TEST_DATABASE || 'app_test';

process.env.NODE_ENV = 'test';
process.env.CENTRAL_MYSQL_DB = TEST_DATABASE;
// Uploads from the tests go to a temporary folder, not the real storage.
process.env.STORAGE_DIR = path.join(os.tmpdir(), `${TEST_DATABASE}-storage`);
// The mailer writes to the log in tests (see MAIL_TRANSPORT in config.js).
process.env.MAIL_TRANSPORT = 'log';
process.env.JOBS_ENABLED = 'false';
// The one browser origin the CORS tests treat as allowed.
process.env.ACCESSDOMAINS = 'http://allowed.test.example';
// Redis keys (cooldowns, lockouts, rate limits) go to a database of their own (default 15), emptied before each run.
process.env.REDIS_DB = process.env.TEST_REDIS_DB || '15';
// Stripe is never called in tests (test/billing.test.js fakes the API calls): placeholder keys, and a webhook secret
// that the test signatures use.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_placeholder';

module.exports = { TEST_DATABASE };
