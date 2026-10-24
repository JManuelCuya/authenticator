// Rutas del módulo local-auth (montadas en /auth/local): login con la base de datos propia
const { Router } = require('express');
const controller = require('./local-auth.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireGuest } = require('../../middlewares/auth.guards');

const router = Router();

router.post('/login', requireGuest, asyncHandler(controller.login));

module.exports = router;
