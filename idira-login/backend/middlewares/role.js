// Rol del usuario en la app (columna "rol" de la tabla usuarios), guardado en la sesión.
// Login con la base propia: se fija al entrar. Login con Idira (SAML o API): se busca aquí la
// primera vez, cruzando la identidad de Idira con la tabla usuarios.
const usersService = require('../modules/users/users.service');
const { canAccess, SCREENS } = require('../modules/screens/screens.permissions');

async function loadRole(req, res, next) {
  if (req.session.user && req.session.rol === undefined) {
    const interno = await usersService.match(req.session.user);
    // Si la base falla no se guarda nada, para reintentar en la siguiente petición
    if (!interno || !interno.error) {
      req.session.rol = interno && interno.usuario.activo ? interno.usuario.rol : null;
    }
  }
  res.locals.rol = req.session.rol || null;
  next();
}

// Solo si el rol del usuario puede ver la pantalla indicada
const requireScreen = (key) => (req, res, next) => {
  if (canAccess(req.session.rol, key)) return next();
  res.status(403).render('screens/forbidden', { pantalla: SCREENS[key], rol: req.session.rol || null });
};

module.exports = { loadRole, requireScreen };
