const express = require('express');
const countryController = require('./country.controller');

const router = express.Router();

// Public: reference data read by sign-up and address forms.
router.get('/', countryController.getAllCountry);
router.get('/:id', countryController.getCountryById);

module.exports = router;
