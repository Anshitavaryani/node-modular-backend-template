const express = require("express");
const router = express.Router();

const { authLimiter } = require("../../core/http/rateLimiter");
const { authenticateAdmin, requireRole } = require("./authenticate");
const { ROLE } = require("./constants");
const auth = require("./auth.validation");
const admin = require("./admin.validation");
const adminAuth = require("./adminAuth.controller");

// Creating admin accounts is for super admins only.
router.post(
  "/register",
  authenticateAdmin,
  requireRole(ROLE.SUPER_ADMIN),
  admin.validateCreateAdminBody,
  adminAuth.createAdminUser
);
router.post("/login", authLimiter, admin.validateLoginAdminBody, adminAuth.loginAdminUser);
router.post(
  "/change-password",
  authLimiter,
  auth.validateResetPasswordBody,
  authenticateAdmin,
  adminAuth.resetAdminPassword
);
// Recovery flow for an admin who cannot sign in, so no token is required.
router.post("/otp", adminAuth.sendOTP);
router.post("/verify-otp", authLimiter, adminAuth.verifyOTP);
router.post("/forgot-password", authLimiter, adminAuth.forgotAdminPassword);

module.exports = router;
