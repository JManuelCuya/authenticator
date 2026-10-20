// Guardias de ruta según el estado de la sesión

// Solo usuarios ya validados por Idira
const requireAuth = (req, res, next) => (req.session.user ? next() : res.redirect('/auth/login'));

// Solo usuarios sin sesión (pantalla de login)
const requireGuest = (req, res, next) => (req.session.user ? res.redirect('/') : next());

// Solo si hay un login en curso con Idira (pasos de MFA)
const requireFlow = (req, res, next) => (req.session.flow ? next() : res.redirect('/auth/login'));

// Solo si el usuario ya eligió un factor de MFA
const requireMechanism = (req, res, next) =>
  req.session.flow && req.session.flow.mech ? next() : res.redirect('/auth/mfa');

module.exports = { requireAuth, requireGuest, requireFlow, requireMechanism };
