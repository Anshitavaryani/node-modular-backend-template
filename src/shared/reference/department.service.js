const ApiError = require('../../core/http/ApiError');
const httpStatus = require('../../core/http/status');
const { models: { Department } } = require('./models');

const createDepartment = async ({ name }) => Department.create({ name });

const updateDepartment = async (body, id) => {
    const department = await Department.findByPk(id);
    if (!department) throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
    if (body.name) department.name = body.name;
    await department.save();
    return department;
};

const getAllDepartments = async () => Department.findAll({ where: { is_active: true } });

const getDepartmentById = async (id) => {
    const department = await Department.findByPk(id);
    if (!department) throw new ApiError(httpStatus.NOT_FOUND, 'Department not found.');
    return department;
};

const findDepartmentById = (id) => Department.findByPk(id);

const deleteDepartment = async (id) => {
    const department = await Department.findByPk(Number(id));
    if (!department) throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
    return department.destroy();
};

module.exports = { createDepartment, updateDepartment, getAllDepartments, getDepartmentById, findDepartmentById, deleteDepartment };
