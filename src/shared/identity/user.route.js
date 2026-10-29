const express = require("express");
const router = express.Router();

const { authenticate } = require("./authenticate");
const auth = require("./auth.validation");
const user = require("./user.controller");

router.use(auth.setRoleIdIfNotPresent);

router.get("/profile", authenticate, user.getProfile);
router.post("/notifications", authenticate, user.toggleNotification);
router.delete("/deactivate", authenticate, user.deactivateAccount);

module.exports = router;
