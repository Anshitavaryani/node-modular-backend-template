// Node loads .env natively (paths.js loads it, first thing). Variables already set in the environment take
// precedence. Quote any value that contains #, or everything from the # onwards is dropped.
require('./paths');

const fail = (message) => {
    throw new Error(`Config validation error: ${message}`);
};

// Empty values (`KEY=`) count as unset.
const envVars = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));

const REQUIRED = ['APP_NAME', 'NODE_ENV', 'CENTRAL_MYSQL_HOST', 'CENTRAL_MYSQL_USER', 'CENTRAL_MYSQL_DB', 'JWT_SECRET', 'USR_ROLE_ID'];
const missing = REQUIRED.filter((key) => envVars[key] === undefined);
if (missing.length) fail(`missing ${missing.join(', ')}`);
if (!['production', 'development', 'test'].includes(envVars.NODE_ENV)) fail('NODE_ENV must be one of production, development, test');

const number = (key, fallback) => {
    if (envVars[key] === undefined) return fallback;
    const value = Number(envVars[key]);
    if (Number.isNaN(value)) fail(`${key} must be a number`);
    return value;
};

const isProduction = envVars.NODE_ENV === 'production';

if (isProduction) {
    if (envVars.JWT_SECRET.length < 32) fail('JWT_SECRET must be at least 32 characters in production (openssl rand -hex 32)');
    for (const key of ['API_BASE_URL', 'ACCESSDOMAINS', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'EMAIL_FROM']) {
        if (envVars[key] === undefined) fail(`${key} is required in production`);
    }
}

envVars.PORT = number('PORT', 5000);
envVars.CENTRAL_MYSQL_PORT = number('CENTRAL_MYSQL_PORT', 3306);
envVars.SMTP_PORT = number('SMTP_PORT', 587);
envVars.DEFAULT_API_DATA_LIMIT = number('DEFAULT_API_DATA_LIMIT', 15);
envVars.MAX_API_DATA_LIMIT = number('MAX_API_DATA_LIMIT', 1000);
envVars.ACCESS_TOKEN_MINUTES = number('ACCESS_TOKEN_MINUTES', 30);
envVars.REFRESH_TOKEN_DAYS = number('REFRESH_TOKEN_DAYS', 30);
envVars.ADMIN_TOKEN_HOURS = number('ADMIN_TOKEN_HOURS', 12);
envVars.REDIS_PORT = number('REDIS_PORT', 6379);
envVars.REDIS_DB = number('REDIS_DB', 0);
envVars.DEFAULT_AMOUNT = number('DEFAULT_AMOUNT', 5);
envVars.BACKUP_RETENTION_DAYS = number('BACKUP_RETENTION_DAYS', 14);
envVars.MAIL_TRANSPORT ??= 'smtp';
if (!['smtp', 'log'].includes(envVars.MAIL_TRANSPORT)) fail('MAIL_TRANSPORT must be smtp or log');
envVars.DEFAULT_TIMEZONE ??= 'UTC';
envVars.API_BASE_URL = envVars.API_BASE_URL ? envVars.API_BASE_URL.replace(/\/+$/, '') : undefined;
envVars.ADMIN_URL = (envVars.ADMIN_URL || 'http://localhost:3000').replace(/\/+$/, '');
envVars.WEBSITE_URL = (envVars.WEBSITE_URL || 'http://localhost:3001').replace(/\/+$/, '');

// The role IDs a person may pick for themselves at registration (header `role_id`). Defaults to the user role only.
const selfRegisterableRoleIds = (envVars.SELF_REGISTERABLE_ROLE_IDS || envVars.USR_ROLE_ID)
    .split(',').map((id) => id.trim()).filter(Boolean);

module.exports = {
    app_name: envVars.APP_NAME,
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    databases: {
        central: {
            db: envVars.CENTRAL_MYSQL_DB,
            port: envVars.CENTRAL_MYSQL_PORT,
            host: envVars.CENTRAL_MYSQL_HOST,
            user: envVars.CENTRAL_MYSQL_USER,
            passwd: envVars.CENTRAL_MYSQL_PASSWORD,
        },
    },
    redis: {
        host: envVars.REDIS_HOST || '127.0.0.1',
        port: envVars.REDIS_PORT,
        password: envVars.REDIS_PASSWORD || undefined,
        db: envVars.REDIS_DB,
        // Keys used by this app start with this prefix, so one Redis server can serve several apps.
        keyPrefix: envVars.REDIS_KEY_PREFIX || `${envVars.APP_NAME.replace(/\s+/g, '-').toLowerCase()}:`,
    },
    jwt: {
        secret: envVars.JWT_SECRET,
        accessTokenMinutes: envVars.ACCESS_TOKEN_MINUTES,
        refreshTokenDays: envVars.REFRESH_TOKEN_DAYS,
        adminTokenHours: envVars.ADMIN_TOKEN_HOURS,
    },
    email: {
        smtp: {
            host: envVars.SMTP_HOST,
            port: envVars.SMTP_PORT,
            secure: envVars.SMTP_SECURE === 'true',
            requireTLS: envVars.SMTP_SECURE !== 'true',
            auth: {
                user: envVars.SMTP_USERNAME,
                pass: envVars.SMTP_PASSWORD,
            },
        },
        from: envVars.EMAIL_FROM,
        // smtp sends real mail; log writes the mail to the console (local development without an SMTP server).
        transport: envVars.MAIL_TRANSPORT,
    },
    accessDomains: envVars.ACCESSDOMAINS,
    defaultLimit: envVars.DEFAULT_API_DATA_LIMIT,
    // The most rows a list route returns in one page, whatever ?limit= asks for.
    maxLimit: envVars.MAX_API_DATA_LIMIT,
    API_BASE_URL: envVars.API_BASE_URL,
    WEBSITE_URL: envVars.WEBSITE_URL,
    ADMIN_URL: envVars.ADMIN_URL,
    DEFAULT_TIMEZONE: envVars.DEFAULT_TIMEZONE,
    // Scheduled jobs run unless JOBS_ENABLED=false (for example on a copy of production data).
    jobsEnabled: envVars.JOBS_ENABLED !== 'false',
    // npm run backup keeps its files (STORAGE_DIR/backups) this many days.
    backupRetentionDays: envVars.BACKUP_RETENTION_DAYS,

    // Stripe (shared/billing): the main account, and the per-country accounts some payment methods use (a country whose
    // keys are not set uses the main account). DEFAULT_AMOUNT is in whole currency units, charged when none is sent.
    stripe: {
        publishableKey: envVars.STRIPE_PUBLISHABLE_KEY,
        secretKey: envVars.STRIPE_SECRET_KEY,
        webhookSecret: envVars.STRIPE_WEBHOOK_SECRET,
        defaultAmount: envVars.DEFAULT_AMOUNT,
        accounts: Object.fromEntries(['MY', 'AU', 'MX', 'WECHAT', 'UK'].map((code) => [code, {
            publishableKey: envVars[`STRIPE_PUBLISHABLE_KEY_${code}`],
            secretKey: envVars[`STRIPE_SECRET_KEY_${code}`],
        }])),
    },

    // Role and department IDs seeded by src/core/db/seeds (set them in .env to match the seeded rows).
    SUP_ADM_ROLE_ID: envVars.SUP_ADM_ROLE_ID,
    ADM_ROLE_ID: envVars.ADM_ROLE_ID,
    USR_ROLE_ID: envVars.USR_ROLE_ID,
    SELF_REGISTERABLE_ROLE_IDS: selfRegisterableRoleIds,
    ADM_DEPT_ID: envVars.ADM_DEPT_ID,
    SUPER_ADMIN_NAME: envVars.SUPER_ADMIN_NAME,
    SUPER_ADMIN_PASSWORD: envVars.SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_EMAIL: envVars.SUPER_ADMIN_EMAIL,
};
