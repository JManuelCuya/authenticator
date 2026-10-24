const config = require('../../config');
const migrationService = require('./migration.service');

async function show(req, res) {
  let usuarios = [];
  let error = '';
  try {
    usuarios = await migrationService.listUsers();
  } catch (err) {
    error = err.message;
  }
  res.render('migration/index', { usuarios, error, api: config.idiraApi });
}

async function run(req, res) {
  // "codigos" llega como texto (uno) o lista (varios) desde los checkbox
  const codigos = [].concat(req.body.codigos || []).filter(Boolean);
  if (!codigos.length) return res.redirect('/admin/migracion');

  try {
    const { resultados, omitidos } = await migrationService.migrate(codigos);
    console.log(`[MIGRACION] ${JSON.stringify({
      fecha: new Date().toISOString(),
      admin: req.session.user.usuario,
      creados: resultados.filter((r) => r.estado === 'creado').map((r) => r.codigo),
      errores: resultados.filter((r) => r.estado === 'error').map((r) => `${r.codigo}: ${r.mensaje}`),
      omitidos,
    })}`);
    res.render('migration/result', { resultados, omitidos });
  } catch (err) {
    console.error(`[MIGRACION] error: ${err.message}`);
    const usuarios = await migrationService.listUsers().catch(() => []);
    res.status(500).render('migration/index', { usuarios, error: err.message, api: config.idiraApi });
  }
}

module.exports = { show, run };
