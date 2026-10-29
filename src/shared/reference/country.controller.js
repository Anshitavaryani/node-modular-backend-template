const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const listParams = require('./listParams');
const countryService = require('./country.service');

const getAllCountry = catchAsync(async (req, res) => {
    const countries = await countryService.getAllCountry(listParams(req.query));
    return responseWrapper(res, countries, '');
});

const getCountryById = catchAsync(async (req, res) => {
    const country = await countryService.getCountryById(req.params.id);
    return responseWrapper(res, country, '');
});

module.exports = { getAllCountry, getCountryById };
