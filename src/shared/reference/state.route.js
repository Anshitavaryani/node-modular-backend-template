const express = require('express');
const stateController = require('./state.controller');

const router = express.Router();

// Public: reference data read by sign-up and address forms.
router.get('/', stateController.getAllState);
router.get('/:id', stateController.getStateById);

module.exports = router;
