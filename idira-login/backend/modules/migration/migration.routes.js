// Rutas del módulo migration (montadas en /admin/migracion, solo administradores)
const { Router } = require('express');
const controller = require('./migration.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireAdmin } = require('../../middlewares/auth.guards');

const router = Router();

router.get('/', requireAdmin, asyncHandler(controller.show));
router.post('/', requireAdmin, asyncHandler(controller.run));

module.exports = router;
