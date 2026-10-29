const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const { models: { Country, State, City } } = require('./models');

const getAllCity = async ({ limit, offset, sortDirection }) => City.findAll({
    attributes: ['id', 'name'],
    where: { is_active: true },
    limit,
    offset,
    order: [['id', sortDirection]],
});

const getCityById = async (id) => {
    const city = await City.findOne({
        attributes: ['id', 'name', 'country_id', 'state_id'],
        include: [
            { model: Country, as: 'country', attributes: ['id', 'name'] },
            { model: State, as: 'state', attributes: ['id', 'name'] },
        ],
        where: { is_active: true, id },
    });
    if (!city) throw new ApiError(httpStatus.NOT_FOUND, 'City not found.');
    return city;
};

const findCityById = (id) => City.findOne({ where: { id, is_active: true } });

module.exports = { getAllCity, getCityById, findCityById };
