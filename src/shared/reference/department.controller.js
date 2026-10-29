const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const departmentService = require('./department.service');

const getAllDepartments = catchAsync(async (req, res) => {
    const departments = await departmentService.getAllDepartments();
    return responseWrapper(res, departments, '');
});

const createDepartment = catchAsync(async (req, res) => {
    const department = await departmentService.createDepartment(req.body);
    return responseWrapper(res, department, 'New department Created Successfully', httpStatus.CREATED);
});

const getDepartmentById = catchAsync(async (req, res) => {
    const department = await departmentService.getDepartmentById(req.params.id);
    return responseWrapper(res, department, '');
});

const updateDepartment = catchAsync(async (req, res) => {
    const department = await departmentService.updateDepartment(req.body, req.params.id);
    return responseWrapper(res, department, 'Department Update Successfully');
});

const deleteDepartment = catchAsync(async (req, res) => {
    await departmentService.deleteDepartment(req.params.id);
    return responseWrapper(res, '', 'Deleted Successfully.', httpStatus.OK);
});

module.exports = { getAllDepartments, createDepartment, getDepartmentById, updateDepartment, deleteDepartment };
