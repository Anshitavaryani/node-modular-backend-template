const config = require('../config/config');
const ApiError = require('./ApiError');
const httpStatus = require('./status');

// Cross-origin access: the origins in ACCESSDOMAINS (comma-separated; spaces and a trailing slash are ignored) may
// call the API with credentials.
const allowedOrigins = (config.accessDomains || '').split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean);

// Options for the cors package: allowed origins, plus requests without an Origin header (server to server, the app).
// A browser on any other origin is refused before the request runs.
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(ApiError.withCode(httpStatus.FORBIDDEN, 'This origin may not call the API.', 'ORIGIN_NOT_ALLOWED'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
};

module.exports = { allowedOrigins, corsOptions };
