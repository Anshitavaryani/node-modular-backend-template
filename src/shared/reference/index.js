// Reference lists: countries, states, cities, roles and departments, plus the lookup services other modules use.
const countryService = require('./country.service');
const stateService = require('./state.service');
const cityService = require('./city.service');
const roleService = require('./role.service');
const departmentService = require('./department.service');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order.
    routes: () => [
        { path: '/role', router: require('./role.route') },
        { path: '/department', router: require('./department.route') },
        { path: '/country', router: require('./country.route') },
        { path: '/state', router: require('./state.route') },
        { path: '/city', router: require('./city.route') },
    ],
    // No scheduled jobs.
    jobs: () => [],

    // For other modules: the row by id, or null when missing (countries, states and cities that are inactive or
    // deleted count as missing; roles and departments only when deleted).
    findCountryById: countryService.findCountryById,
    findStateById: stateService.findStateById,
    findCityById: cityService.findCityById,
    findRoleById: roleService.findRoleById,
    findDepartmentById: departmentService.findDepartmentById,
};
