const express = require('express');
const { authenticateAdmin } = require('../identity');
const contactUsController = require('./contactUs.controller');

const router = express.Router();

// The public contact form posts here. Submissions hold personal data, so listing and changing them is admin-only.
router.post('/', contactUsController.createContactUs);
router.get('/', authenticateAdmin, contactUsController.getAllContactUs);
router.put('/:id', authenticateAdmin, contactUsController.updateContactUs);
router.delete('/:id', authenticateAdmin, contactUsController.deleteContactUs);

module.exports = router;
