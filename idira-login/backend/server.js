// Punto de entrada: levanta el servidor
const config = require('./config');
const app = require('./app');
const openBrowser = require('./helpers/openBrowser');
const { ensureSchema } = require('./integrations/db.schema');

app.listen(config.port, config.host, () => {
  if (!config.idira.configured) console.warn(`AVISO: Idira no configurado. Faltan en .env: ${config.idira.missing.join(', ')}`);
  console.log(`${config.baseUrl}`);
  if (config.openBrowser) openBrowser(config.baseUrl);

  // Tablas de roles y permisos (si la base no responde, se reintenta en la primera petición)
  ensureSchema().catch((err) => console.error(`Postgres: no se pudieron preparar roles y permisos: ${err.message}`));
});
