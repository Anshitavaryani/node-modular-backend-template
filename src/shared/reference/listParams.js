const config = require('../../core/config/config');

const SORT_DIRECTIONS = ['ASC', 'DESC'];

// Paging and order for the list routes: ?page= (1-based), ?limit= (default DEFAULT_API_DATA_LIMIT), ?sortBy=ASC|DESC
// (order by id; anything else falls back to ASC).
const listParams = (query) => {
    const limit = parseInt(query.limit, 10) || config.defaultLimit;
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const direction = String(query.sortBy || 'ASC').toUpperCase();
    return {
        limit,
        offset: (page - 1) * limit,
        sortDirection: SORT_DIRECTIONS.includes(direction) ? direction : 'ASC',
    };
};

module.exports = listParams;
