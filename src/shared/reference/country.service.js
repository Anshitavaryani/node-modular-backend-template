const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const { models: { Country, State } } = require('./models');

const getAllCountry = async ({ limit, offset, sortDirection }) => Country.findAll({
    attributes: ['id', 'name'],
    where: { is_active: true },
    limit,
    offset,
    order: [['id', sortDirection]],
});

const getCountryById = async (id) => {
    const country = await Country.findOne({
        attributes: ['id', 'name'],
        include: [{ model: State, as: 'all_state', attributes: ['id', 'name', 'country_id'] }],
        where: { is_active: true, id },
    });
    if (!country) throw new ApiError(httpStatus.NOT_FOUND, 'Country not found.');
    return country;
};

const findCountryById = (id) => Country.findOne({ where: { id, is_active: true } });

module.exports = { getAllCountry, getCountryById, findCountryById };
