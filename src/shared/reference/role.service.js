const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const { models: { Role } } = require('./models');

const createRole = async ({ name, abbreviation }) => {
    const role = await Role.create({ name, abbreviation });
    return !!role;
};

const updateRole = async (body, id) => {
    const role = await Role.findByPk(id);
    if (!role) throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');

    const provided = ['name', 'abbreviation'].filter((field) => body[field]);
    // A role's name and abbreviation are set together: sending one without the other is refused.
    if (provided.length === 1) throw new ApiError(httpStatus.BAD_REQUEST, 'Name and Abbreviation both needed.');

    provided.forEach((field) => { role[field] = body[field]; });
    await role.save();
    return role;
};

const getAllRoles = async () => Role.findAll({ where: { is_active: true } });

const getRoleById = async (id) => {
    const role = await Role.findByPk(id);
    if (!role) throw new ApiError(httpStatus.NOT_FOUND, 'Role not found.');
    return role;
};

const findRoleById = (id) => Role.findByPk(id);

const deleteRole = async (id) => {
    const role = await Role.findByPk(id);
    if (!role) throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    await role.destroy();
};

module.exports = { createRole, updateRole, getAllRoles, getRoleById, findRoleById, deleteRole };
