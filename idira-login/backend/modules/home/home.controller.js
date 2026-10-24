const usersService = require('../users/users.service');

async function showHome(req, res) {
  res.render('home/index', {
    user: req.session.user,
    saml: req.session.saml,
    // Cruce con la base de datos propia de la app (null si no está registrado, { error } si la base falla)
    interno: await usersService.match(req.session.user),
  });
}

module.exports = { showHome };
