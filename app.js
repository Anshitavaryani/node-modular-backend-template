const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const httpStatus = require('./src/core/http/status');
const ApiError = require('./src/core/http/ApiError');
const errorHandler = require('./src/core/http/errorHandler');
const { credentials, corsOptions } = require('./src/core/http/cors');
const logger = require('./src/core/logger');
const config = require('./src/core/config/config');
const db = require('./src/core/db/central.db');
const redisIsHealthy = require('./src/core/redis/connection').isHealthy;
const routes = require('./src/routes');
const path = require('path');
const { ROOT_DIR, UPLOADS_DIR } = require('./src/core/config/paths');
const { FIELDS } = require('./src/core/http/uploads');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
require('./src/models'); // loads every table and its associations before any route runs

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
// The raw body is kept for webhook signature checks (Stripe signs the exact bytes it sent).
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
app.use(credentials);
app.use(cors(corsOptions));

if (config.env !== 'test') {
    app.use((req, res, next) => {
        const started = Date.now();
        res.on('finish', () => logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`));
        next();
    });
}

app.use(express.static(PUBLIC_DIR));
// Uploaded files, served at /<field> (images, gifs, videos, docs, audios) from STORAGE_DIR/uploads.
for (const field of FIELDS) app.use(`/${field}`, express.static(path.join(UPLOADS_DIR, field)));

// Liveness plus readiness: 200 only when the database and Redis both answer.
app.get('/api/healthcheck', async (req, res) => {
    const checks = { database: false, redis: false };
    try {
        await db.authenticate();
        checks.database = true;
    } catch {
        checks.database = false;
    }
    checks.redis = await redisIsHealthy();
    const ok = Object.values(checks).every(Boolean);
    return res.status(ok ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE).json({ response: ok ? 'ok' : 'degraded', checks });
});

app.get('/test', (req, res) => res.status(httpStatus.OK).send('Hello World !!'));

app.use('/api/v1', routes);

// Any unknown path is a 404 in the standard error shape.
app.use((req, res, next) => next(new ApiError(httpStatus.NOT_FOUND, 'Not found')));
app.use(errorHandler);

module.exports = app;
