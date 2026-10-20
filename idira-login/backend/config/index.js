// Configuración central: lee .env una sola vez y la expone al resto del backend
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = process.env;

const config = {
  port: Number(env.PORT) || 3000,
  // 127.0.0.1 en local / VPS con Nginx; 0.0.0.0 dentro de Docker
  host: env.HOST || '127.0.0.1',
  baseUrl: (env.BASE_URL || '').replace(/\/$/, ''),
  sessionSecret: env.SESSION_SECRET,
  openBrowser: !env.NO_OPEN,
  idira: {
    tenantUrl: (env.IDIRA_TENANT_URL || '').replace(/\/$/, ''),
    tenantId: env.IDIRA_TENANT_ID || '',
  },
  paths: {
    views: path.resolve(__dirname, '../../frontend/views'),
    public: path.resolve(__dirname, '../../frontend/public'),
  },
};

config.isHttps = config.baseUrl.startsWith('https://');
config.idira.missing = Object.entries({ IDIRA_TENANT_URL: config.idira.tenantUrl, IDIRA_TENANT_ID: config.idira.tenantId })
  .filter(([, v]) => !v)
  .map(([k]) => k);
config.idira.configured = config.idira.missing.length === 0;

if (!config.baseUrl || !config.sessionSecret) {
  console.error('Faltan BASE_URL o SESSION_SECRET en .env');
  process.exit(1);
}

module.exports = config;
