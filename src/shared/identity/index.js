// Accounts and sign-in for users and admins: registration and one-time codes, sessions, profiles, and admin accounts.
const { authenticate, optionalAuth, authenticateAdmin, requireRole } = require("./authenticate");
const { createAdminUser } = require("./adminAuth.service");
const { findUserById } = require("./user.service");
const { ROLE } = require("./constants");
const { validatePassword, PASSWORD_RULES } = require("./passwordRules");

module.exports = {
  // Mounted under /api/v1 by src/routes.js, in this order.
  routes: () => [
    { path: "/user/auth/", router: require("./userAuth.route") },
    { path: "/user/", router: require("./user.route") },
    { path: "/admin/auth/", router: require("./adminAuth.route") },
  ],
  // No scheduled jobs.
  jobs: () => [],
  // Middleware for other modules' routes:
  // authenticate: user token (x-access-token). Sets req.user (User instance with user_profile) and req.tokenDoc; 401 otherwise.
  authenticate,
  // optionalAuth: as authenticate; a missing or invalid token leaves req.user null.
  optionalAuth,
  // authenticateAdmin: admin token. Sets req.admin (the Admin row, with role_id and department_id); 401 otherwise.
  authenticateAdmin,
  // requireRole(...abbreviations): 401 unless the caller's role (req.admin, else req.user) is listed.
  requireRole,
  // ROLE: the seeded role abbreviations requireRole() compares against (SUPER_ADMIN: "SUP_ADM", ADMIN: "ADM"...).
  ROLE,
  // Services for other modules:
  // findUserById(id): the active user with that id, or null.
  findUserById,
  // createAdminUser(fields): creates an admin (hashes the password); returns it without credentials.
  createAdminUser,
  // validatePassword(password): whether a new password meets the rules; PASSWORD_RULES is the message when not.
  validatePassword,
  PASSWORD_RULES,
};
