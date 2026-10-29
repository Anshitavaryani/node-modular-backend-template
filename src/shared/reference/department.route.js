const express = require('express');
const departmentController = require('./department.controller');
const { requireAdminRole } = require('./access.middleware');

const router = express.Router();

// Departments are internal admin structure: every route is admin-only.
router.post('/', requireAdminRole, departmentController.createDepartment);
router.get('/', requireAdminRole, departmentController.getAllDepartments);
router.get('/:id', requireAdminRole, departmentController.getDepartmentById);
router.put('/:id', requireAdminRole, departmentController.updateDepartment);
router.delete('/:id', requireAdminRole, departmentController.deleteDepartment);

module.exports = router;
