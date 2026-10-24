// Rutas del módulo screens: cada pantalla exige su permiso (tabla rol_permisos)
const { Router } = require('express');
const controller = require('./screens.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireAuth } = require('../../middlewares/auth.guards');
const { loadRole, requirePermission } = require('../../middlewares/role');

const router = Router();
const guard = (permiso) => [requireAuth, asyncHandler(loadRole), asyncHandler(requirePermission(permiso))];

router.get('/panel-alumno', ...guard('panel_alumno'), controller.panelAlumno);
router.get('/panel-docente', ...guard('panel_docente'), controller.panelDocente);

module.exports = router;
