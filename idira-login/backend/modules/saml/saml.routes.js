// Rutas del módulo SAML (montadas en /auth/saml)
const { Router } = require('express');
const controller = require('./saml.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireGuest } = require('../../middlewares/auth.guards');

const router = Router();

router.get('/login', requireGuest, asyncHandler(controller.login));
router.post('/acs', asyncHandler(controller.acs));
router.get('/metadata', controller.metadata);
router.get('/info', controller.info);

module.exports = router;
