// Guardias de ruta según el estado de la sesión
const config = require('../config');

// Administrador: su login o correo de Idira está en ADMIN_USERS
const isAdmin = (user) =>
  Boolean(user) && [user.usuario, user.correo].some((v) => v && config.adminUsers.includes(String(v).toLowerCase()));

// Solo usuarios ya validados por Idira
const requireAuth = (req, res, next) => (req.session.user ? next() : res.redirect('/auth/login'));

// Solo usuarios sin sesión (pantalla de login)
const requireGuest = (req, res, next) => (req.session.user ? res.redirect('/') : next());

// Solo si hay un login en curso con Idira (pasos de MFA)
const requireFlow = (req, res, next) => (req.session.flow ? next() : res.redirect('/auth/login'));

// Solo si el usuario ya eligió un factor de MFA
const requireMechanism = (req, res, next) =>
  req.session.flow && req.session.flow.mech ? next() : res.redirect('/auth/mfa');

// Solo administradores (después de iniciar sesión con Idira)
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  if (!isAdmin(req.session.user)) {
    return res.status(403).render('admin/forbidden', { user: req.session.user, sinAdmins: !config.adminUsers.length });
  }
  next();
}

module.exports = { isAdmin, requireAuth, requireGuest, requireFlow, requireMechanism, requireAdmin };
