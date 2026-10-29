const express = require('express');
const roleController = require('./role.controller');
const { requireSuperAdmin } = require('./access.middleware');

const router = express.Router();

// Roles are what every admin permission check resolves against, so all of this is super-admin only.
router.post('/', requireSuperAdmin, roleController.createRole);
router.get('/', requireSuperAdmin, roleController.getAllRoles);
router.get('/:id', requireSuperAdmin, roleController.getRoleById);
router.put('/:id', requireSuperAdmin, roleController.updateRole);
router.delete('/:id', requireSuperAdmin, roleController.deleteRole);

module.exports = router;
