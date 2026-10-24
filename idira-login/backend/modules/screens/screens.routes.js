// Rutas del módulo screens: pantallas protegidas por rol
const { Router } = require('express');
const controller = require('./screens.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireAuth } = require('../../middlewares/auth.guards');
const { loadRole, requireScreen } = require('../../middlewares/role');

const router = Router();

router.get('/pantalla-a', requireAuth, asyncHandler(loadRole), requireScreen('a'), controller.screenA);
router.get('/pantalla-b', requireAuth, asyncHandler(loadRole), requireScreen('b'), asyncHandler(controller.screenB));

module.exports = router;
