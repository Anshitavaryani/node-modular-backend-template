const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const listParams = require('./listParams');
const cityService = require('./city.service');

const getAllCity = catchAsync(async (req, res) => {
    const cities = await cityService.getAllCity(listParams(req.query));
    return responseWrapper(res, cities, '');
});

const getCityById = catchAsync(async (req, res) => {
    const city = await cityService.getCityById(req.params.id);
    return responseWrapper(res, city, '');
});

module.exports = { getAllCity, getCityById };
