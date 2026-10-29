const config = require('../../core/config/config');

const SORT_DIRECTIONS = ['ASC', 'DESC'];

// Paging and order for the list routes: ?page= (1-based), ?limit= (default DEFAULT_API_DATA_LIMIT, at most
// MAX_API_DATA_LIMIT; anything below 1 gives the default), ?sortBy=ASC|DESC (order by id; anything else gives ASC).
const listParams = (query) => {
    const asked = parseInt(query.limit, 10);
    const limit = asked >= 1 ? Math.min(asked, config.maxLimit) : config.defaultLimit;
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const direction = String(query.sortBy || 'ASC').toUpperCase();
    return {
        limit,
        offset: (page - 1) * limit,
        sortDirection: SORT_DIRECTIONS.includes(direction) ? direction : 'ASC',
    };
};

module.exports = listParams;
