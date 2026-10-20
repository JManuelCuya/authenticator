// Envuelve controladores async para que sus errores lleguen al errorHandler
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
