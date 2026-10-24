const usersService = require('../users/users.service');
const { isAdmin } = require('../../middlewares/auth.guards');

async function showHome(req, res) {
  res.render('home/index', {
    user: req.session.user,
    esAdmin: isAdmin(req.session.user),
    saml: req.session.saml,
    // Cruce con la base de datos propia de la app (null si no está registrado, { error } si la base falla)
    interno: await usersService.match(req.session.user),
  });
}

module.exports = { showHome };
