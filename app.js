const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const httpStatus = require('./src/core/http/status');
const ApiError = require('./src/core/http/ApiError');
const errorHandler = require('./src/core/http/errorHandler');
const catchAsync = require('./src/core/http/catchAsync');
const { corsOptions } = require('./src/core/http/cors');
const requestLogger = require('./src/core/http/requestLogger');
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

// Uploaded files (/images, /videos...) are loaded by frontends on other origins, which helmet's default
// Cross-Origin-Resource-Policy (same-origin) would block. The starter made the same exception.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
// The raw body is kept for signed webhooks (a signature is checked against the exact bytes received).
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
// cors() answers preflight requests and sets the CORS headers for the origins in ACCESSDOMAINS.
app.use(cors(corsOptions));

if (config.env !== 'test') app.use(requestLogger);

app.use(express.static(PUBLIC_DIR));
// Uploaded files, served at /<field> (images, gifs, videos, docs, audios) from STORAGE_DIR/uploads.
for (const field of FIELDS) app.use(`/${field}`, express.static(path.join(UPLOADS_DIR, field)));

// Liveness plus readiness: 200 only when the database and Redis both answer.
app.get('/api/healthcheck', catchAsync(async (req, res) => {
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
}));

app.use('/api/v1', routes);

// Any unknown path is a 404 in the standard error shape.
app.use((req, res, next) => next(new ApiError(httpStatus.NOT_FOUND, 'Not found')));
app.use(errorHandler);

module.exports = app;
