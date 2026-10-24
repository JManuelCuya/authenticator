const usersService = require('../users/users.service');
const permissionsService = require('../permissions/permissions.service');
const { isAdmin } = require('../../middlewares/auth.guards');

async function showHome(req, res) {
  let pantallas = [];
  try {
    // Pantallas que puede ver según su rol (tabla rol_permisos)
    pantallas = await permissionsService.permissionsOf(req.session.rol);
  } catch (err) {
    console.error('Postgres:', err.message);
  }
  res.render('home/index', {
    user: req.session.user,
    esAdmin: isAdmin(req.session.user),
    saml: req.session.saml,
    // Cruce con la base de datos propia de la app (null si no está registrado, { error } si la base falla)
    interno: await usersService.match(req.session.user),
    rol: req.session.rol || null,
    pantallas,
  });
}

module.exports = { showHome };
