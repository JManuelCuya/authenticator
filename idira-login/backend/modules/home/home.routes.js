// Rutas del módulo home (área privada, requiere login con Idira)
const { Router } = require('express');
const controller = require('./home.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireAuth } = require('../../middlewares/auth.guards');
const { loadRole } = require('../../middlewares/role');

const router = Router();

router.get('/', requireAuth, asyncHandler(loadRole), asyncHandler(controller.showHome));

module.exports = router;
