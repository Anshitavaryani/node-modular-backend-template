const express = require('express');
const { authenticateAdmin } = require('../identity');
const faqController = require('./faq.controller');

const router = express.Router();

// The FAQ is public; changing it needs an admin.
router.get('/', faqController.getAllFaq);
router.post('/', authenticateAdmin, faqController.createFaq);
router.put('/:id', authenticateAdmin, faqController.updateFaq);
router.delete('/:id', authenticateAdmin, faqController.deleteFaq);

module.exports = router;
