const express = require('express');
const { authenticateAdmin, requireRole, ROLE } = require('../identity');
const contactUsController = require('./contactUs.controller');

const router = express.Router();
const { limiter } = require('../../core/http/rateLimiter');

// The public contact form posts here. Submissions hold personal data, so listing and changing them is for the admin
// tier only (as in the starter): super admin, admin or sub-admin.
const requireAdminTier = [authenticateAdmin, requireRole(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN)];

// Anyone may send a message; the limit (production only) stops one address from flooding the list.
router.post('/', limiter('contact', { windowMs: 60 * 60 * 1000, limit: 10, message: 'Too many messages. Please try again later.' }), contactUsController.createContactUs);
router.get('/', requireAdminTier, contactUsController.getAllContactUs);
router.put('/:id', requireAdminTier, contactUsController.updateContactUs);
router.delete('/:id', requireAdminTier, contactUsController.deleteContactUs);

module.exports = router;
