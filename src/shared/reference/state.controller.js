const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const listParams = require('./listParams');
const stateService = require('./state.service');

const getAllState = catchAsync(async (req, res) => {
    const states = await stateService.getAllState(listParams(req.query));
    return responseWrapper(res, states, '', httpStatus.OK);
});

const getStateById = catchAsync(async (req, res) => {
    const state = await stateService.getStateById(req.params.id);
    return responseWrapper(res, state, '', httpStatus.OK);
});

module.exports = { getAllState, getStateById };
