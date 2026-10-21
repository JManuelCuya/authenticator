// Variables disponibles en todas las vistas
const config = require('../config');

module.exports = (req, res, next) => {
  res.locals.idira = { configured: config.idira.configured, missing: config.idira.missing };
  res.locals.samlEnabled = config.saml.configured;
  next();
};
