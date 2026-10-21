const config = require('../../config');
const samlService = require('./saml.service');

// Inicia el login SAML: redirige a Idira
async function login(req, res) {
  try {
    res.redirect(await samlService.getLoginUrl());
  } catch (err) {
    console.error('SAML:', err.message);
    res.status(500).render('auth/login', { error: err.message, username: '' });
  }
}

// ACS: Idira envía aquí (POST) la respuesta firmada
async function acs(req, res, next) {
  try {
    const user = await samlService.handleAcs(req.body);
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = user;
      res.redirect('/');
    });
  } catch (err) {
    console.error('SAML:', err.message);
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
