const express = require('express');
const cityController = require('./city.controller');

const router = express.Router();

// Public: reference data read by sign-up and address forms.
router.get('/', cityController.getAllCity);
router.get('/:id', cityController.getCityById);

module.exports = router;
