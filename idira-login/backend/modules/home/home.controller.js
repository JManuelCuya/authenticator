const usersService = require('../users/users.service');
const { isAdmin } = require('../../middlewares/auth.guards');
const { menuFor } = require('../screens/screens.permissions');

async function showHome(req, res) {
  res.render('home/index', {
    user: req.session.user,
    esAdmin: isAdmin(req.session.user),
    saml: req.session.saml,
    // Cruce con la base de datos propia de la app (null si no está registrado, { error } si la base falla)
    interno: await usersService.match(req.session.user),
    // Pantallas que puede ver según su rol en la app
    rol: req.session.rol || null,
    pantallas: menuFor(req.session.rol),
  });
}

module.exports = { showHome };
