const { authenticateAdmin } = require('../identity');
const catchAsync = require('../../core/http/catchAsync');
const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const { models: { Role } } = require('./models');

// Matched by the role's abbreviation (the seeded, stable code), not its display name, which projects rename.
const SUPER_ADMIN = 'SUP_ADM';
const ADMIN = 'ADM';
const SUB_ADMIN = 'SUB_ADM';

// Lets through an admin whose role is one of the given abbreviations. Runs after authenticateAdmin, which sets
// req.admin; an admin without a resolvable role is refused.
const requireRole = (...abbreviations) => catchAsync(async (req, res, next) => {
    const roleId = req.admin && req.admin.role_id;
    const role = roleId ? await Role.findByPk(roleId) : null;
    if (!role || !abbreviations.includes(role.abbreviation)) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized to access this api');
    }
    next();
});

// Role administration: super admins only.
const requireSuperAdmin = [authenticateAdmin, requireRole(SUPER_ADMIN)];

// Department administration: super admins, admins and sub-admins.
const requireAdminRole = [authenticateAdmin, requireRole(SUPER_ADMIN, ADMIN, SUB_ADMIN)];

module.exports = { requireSuperAdmin, requireAdminRole };
