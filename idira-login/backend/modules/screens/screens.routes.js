// Rutas del módulo screens: cada pantalla exige su permiso (tabla rol_permisos)
const { Router } = require('express');
const controller = require('./screens.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireAuth } = require('../../middlewares/auth.guards');
const { loadRole, requirePermission } = require('../../middlewares/role');

const router = Router();
const guard = (permiso) => [requireAuth, asyncHandler(loadRole), asyncHandler(requirePermission(permiso))];

router.get('/listado', ...guard('listado'), controller.listado);
router.get('/inventario', ...guard('inventario'), controller.inventario);
router.get('/panel', ...guard('panel'), asyncHandler(controller.panel));

module.exports = router;
