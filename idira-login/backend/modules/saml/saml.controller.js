const config = require('../../config');
const samlService = require('./saml.service');

// Una línea JSON por evento SAML: se ve y se filtra fácil en los logs de Easypanel
function log(req, evento, datos) {
  const linea = { fecha: new Date().toISOString(), evento, ip: req.ip, navegador: req.get('user-agent'), ...datos };
  (evento.endsWith('error') ? console.error : console.log)(`[SAML] ${JSON.stringify(linea)}`);
}

// Inicia el login SAML: redirige a Idira
async function login(req, res) {
  try {
    const url = await samlService.getLoginUrl();
    log(req, 'login-inicio', { idp: url.split('?')[0] });
    res.redirect(url);
  } catch (err) {
    log(req, 'login-inicio-error', { error: err.message });
    res.status(500).render('auth/login', { error: err.message, username: '' });
  }
}

// ACS: Idira envía aquí (POST) la respuesta firmada
async function acs(req, res, next) {
  try {
    const { user, detalle } = await samlService.handleAcs(req.body);
    log(req, 'login-ok', { usuario: user.usuario, correo: user.correo, ...detalle });
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = user;
      req.session.saml = detalle;
      res.redirect('/');
    });
  } catch (err) {
    log(req, 'login-error', { error: err.message, recibido: samlService.diagnose(req.body) });
    res.status(401).render('auth/login', { error: `Validación SAML fallida: ${err.message}`, username: '' });
  }
}

function metadata(req, res) {
  res.type('application/xml').send(samlService.getMetadata());
}

// Página con los datos a entregar al administrador del IdP
function info(req, res) {
  res.render('saml/info', { saml: config.saml });
}

module.exports = { login, acs, metadata, info };
