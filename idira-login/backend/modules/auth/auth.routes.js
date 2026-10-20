// Rutas del módulo auth (montadas en /auth)
const { Router } = require('express');
const controller = require('./auth.controller');
const asyncHandler = require('../../helpers/asyncHandler');
const { requireGuest, requireFlow, requireMechanism } = require('../../middlewares/auth.guards');

const router = Router();

router.get('/login', requireGuest, controller.showLogin);
router.post('/login', requireGuest, asyncHandler(controller.login));

router.get('/mfa', requireFlow, controller.showMfa);
router.post('/mfa/elegir', requireFlow, asyncHandler(controller.chooseMechanism));

router.get('/mfa/codigo', requireMechanism, controller.showCode);
router.post('/mfa/codigo', requireMechanism, asyncHandler(controller.submitCode));

router.get('/mfa/esperar', requireMechanism, controller.showWait);
router.get('/mfa/consultar', requireMechanism, asyncHandler(controller.poll));

router.get('/logout', controller.logout);

module.exports = router;
