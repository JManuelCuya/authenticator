// Punto de entrada: levanta el servidor
const config = require('./config');
const app = require('./app');
const openBrowser = require('./helpers/openBrowser');

app.listen(config.port, config.host, () => {
  if (!config.idira.configured) console.warn(`AVISO: Idira no configurado. Faltan en .env: ${config.idira.missing.join(', ')}`);
  console.log(`${config.baseUrl}`);
  if (config.openBrowser) openBrowser(config.baseUrl);
});
