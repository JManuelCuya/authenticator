const localAuthService = require('./local-auth.service');
const limiter = require('../../helpers/loginLimiter');

function log(req, evento, datos) {
  const linea = { fecha: new Date().toISOString(), evento, ip: req.ip, ...datos };
  (evento.endsWith('error') ? console.error : console.log)(`[LOCAL] ${JSON.stringify(linea)}`);
}

async function login(req, res, next) {
  const { username = '', password = '' } = req.body;
  const fail = (error, status = 401) => res.status(status).render('auth/login', { error, username });

  const minutos = limiter.blockedMinutes(req.ip, username);
  if (minutos) {
    log(req, 'login-bloqueado', { usuario: username });
    return fail(`Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto(s).`, 429);
  }

  let result;
  try {
    result = await localAuthService.login(username, password);
  } catch (err) {
    log(req, 'login-error', { usuario: username, error: err.message });
    return fail(`No se pudo consultar la base de datos: ${err.message}`, 500);
  }

  if (result.error) {
    limiter.registerFail(req.ip, username);
    log(req, 'login-fallido', { usuario: username, motivo: result.error });
    return fail(result.error);
  }

  limiter.reset(req.ip, username);
  log(req, 'login-ok', { usuario: result.user.usuario });
  // Sesión nueva tras autenticar (evita session fixation)
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = result.user;
    req.session.rol = result.rol;
    res.redirect('/');
  });
}

module.exports = { login };
