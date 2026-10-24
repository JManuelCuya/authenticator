const usersService = require('../users/users.service');
const { SCREENS } = require('./screens.permissions');

// Pantalla A (consulta): la ven los roles consulta y admin
const screenA = (req, res) =>
  res.render('screens/a', { pantalla: SCREENS.a, user: req.session.user, rol: req.session.rol });

// Pantalla B (administración): solo admin. Muestra los usuarios de la base con su rol.
async function screenB(req, res) {
  let usuarios = [];
  let error = '';
  try {
    usuarios = await usersService.list();
  } catch (err) {
    error = `No se pudo consultar la base de datos: ${err.message}`;
  }
  res.render('screens/b', { pantalla: SCREENS.b, user: req.session.user, rol: req.session.rol, usuarios, error });
}

module.exports = { screenA, screenB };
