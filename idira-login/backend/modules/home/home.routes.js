// Rutas del módulo home (área privada, requiere login con Idira)
const { Router } = require('express');
const controller = require('./home.controller');
const { requireAuth } = require('../../middlewares/auth.guards');

const router = Router();

router.get('/', requireAuth, controller.showHome);

module.exports = router;
