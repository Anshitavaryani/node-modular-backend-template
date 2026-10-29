const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const { models: { Country, State, City } } = require('./models');

const getAllState = async ({ limit, offset, sortDirection }) => State.findAll({
    attributes: ['id', 'name'],
    where: { is_active: true },
    limit,
    offset,
    order: [['id', sortDirection]],
});

const getStateById = async (id) => {
    const state = await State.findOne({
        attributes: ['id', 'name'],
        include: [
            { model: Country, as: 'country', attributes: ['id', 'name'] },
            { model: City, as: 'all_city', attributes: ['id', 'name'] },
        ],
        where: { is_active: true, id },
    });
    if (!state) throw new ApiError(httpStatus.NOT_FOUND, 'State not found.');
    return state;
};

const findStateById = (id) => State.findOne({ where: { id, is_active: true } });

module.exports = { getAllState, getStateById, findStateById };
