const express = require('express');
const { authenticateAdmin, requireRole, ROLE } = require('../identity');
const faqController = require('./faq.controller');

const router = express.Router();

// The FAQ is public; changing it needs an admin in the editor tier (as in the starter): super admin, admin, sub-admin,
// engineer or editor.
const requireEditor = [authenticateAdmin, requireRole(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN, ROLE.ENGINEER, ROLE.EDITOR)];

router.get('/', faqController.getAllFaq);
router.post('/', requireEditor, faqController.createFaq);
router.put('/:id', requireEditor, faqController.updateFaq);
router.delete('/:id', requireEditor, faqController.deleteFaq);

module.exports = router;
