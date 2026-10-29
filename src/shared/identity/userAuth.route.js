const express = require("express");
const router = express.Router();

const { authLimiter, codeLimiter } = require("../../core/http/rateLimiter");
const { uploadFields } = require("../../core/http/uploads");
const { REGISTER_UPLOADS } = require("./constants");
const { authenticate } = require("./authenticate");
const auth = require("./auth.validation");
const userAuth = require("./userAuth.controller");

const registerUploads = Object.keys(REGISTER_UPLOADS).map((name) => ({ name, maxCount: 10 }));

router.use(auth.setRoleIdIfNotPresent);
// Every path here is limited per IP in production (failed requests count; see core/http/rateLimiter.js).
router.use(authLimiter);

router.post("/otp", codeLimiter, userAuth.sendOTP);
router.post("/verify-otp", userAuth.verifyOTP);
router.post(
  "/register",
  uploadFields(registerUploads),
  auth.validateRegisterBody,
  userAuth.register
);
router.post("/login", auth.validateSignInBody, userAuth.login);
// Body check first, then the signed-in account: the same order as the starter.
router.post(
  "/reset-password",
  auth.validateResetPasswordBody,
  authenticate,
  userAuth.resetPassword
);
router.post(
  "/forgot-password",
  auth.validateForgotPasswordRequest,
  userAuth.forgotPassword
);
router.get("/logout", authenticate, userAuth.logout);

module.exports = router;
