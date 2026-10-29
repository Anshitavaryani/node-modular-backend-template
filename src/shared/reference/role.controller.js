const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const roleService = require('./role.service');

const createRole = catchAsync(async (req, res) => {
    const created = await roleService.createRole(req.body);
    return responseWrapper(res, created, 'New Role Created Successfully.', httpStatus.CREATED);
});

const getAllRoles = catchAsync(async (req, res) => {
    const roles = await roleService.getAllRoles();
    return responseWrapper(res, roles, '', httpStatus.OK);
});

const getRoleById = catchAsync(async (req, res) => {
    const role = await roleService.getRoleById(req.params.id);
    return responseWrapper(res, role, '', httpStatus.OK);
});

const updateRole = catchAsync(async (req, res) => {
    const role = await roleService.updateRole(req.body, req.params.id);
    return responseWrapper(res, role, 'Role Updated Successfully', httpStatus.OK);
});

const deleteRole = catchAsync(async (req, res) => {
    await roleService.deleteRole(req.params.id);
    return responseWrapper(res, '', 'Delete Successfull.');
});

module.exports = { createRole, getAllRoles, getRoleById, updateRole, deleteRole };
