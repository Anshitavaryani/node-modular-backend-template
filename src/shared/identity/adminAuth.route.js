const express = require("express");
const router = express.Router();

const { authLimiter, codeLimiter } = require("../../core/http/rateLimiter");
const { authenticateAdmin, requireRole } = require("./authenticate");
const { ROLE } = require("./constants");
const auth = require("./auth.validation");
const admin = require("./admin.validation");
const adminAuth = require("./adminAuth.controller");

// Every path here is limited per IP in production (failed requests count; see core/http/rateLimiter.js).
router.use(authLimiter);

// Creating admin accounts is for super admins only.
router.post(
  "/register",
  authenticateAdmin,
  requireRole(ROLE.SUPER_ADMIN),
  admin.validateCreateAdminBody,
  adminAuth.createAdminUser
);
router.post("/login", admin.validateLoginAdminBody, adminAuth.loginAdminUser);
router.post(
  "/change-password",
  auth.validateResetPasswordBody,
  authenticateAdmin,
  adminAuth.resetAdminPassword
);
// Recovery flow for an admin who cannot sign in, so no token is required.
router.post("/otp", codeLimiter, adminAuth.sendOTP);
router.post("/verify-otp", adminAuth.verifyOTP);
router.post("/forgot-password", adminAuth.forgotAdminPassword);

module.exports = router;
