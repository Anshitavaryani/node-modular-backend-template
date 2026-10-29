const { authenticateAdmin, requireRole, ROLE } = require('../identity');

// Role administration: super admins only.
const requireSuperAdmin = [authenticateAdmin, requireRole(ROLE.SUPER_ADMIN)];

// Department administration: super admins, admins and sub-admins.
const requireAdminRole = [authenticateAdmin, requireRole(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN)];

module.exports = { requireSuperAdmin, requireAdminRole };
