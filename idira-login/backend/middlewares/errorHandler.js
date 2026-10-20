const { IdiraError } = require('../integrations/idira.client');

// Rutas inexistentes
const notFound = (req, res) => res.redirect('/');

// Errores de Idira: se cancela el login en curso y se vuelve a la pantalla de login con el mensaje.
// Cualquier otro error: mensaje genérico (el detalle queda en el log del servidor).
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err instanceof IdiraError ? `Idira: ${err.message}` : err);
  if (req.session) req.session.flow = null;

  const isIdira = err instanceof IdiraError;
  res.status(isIdira ? 401 : 500).render('auth/login', {
    error: isIdira ? err.message : 'Ocurrió un error inesperado, intenta de nuevo.',
    username: (req.body && req.body.username) || '',
  });
};

module.exports = { notFound, errorHandler };
