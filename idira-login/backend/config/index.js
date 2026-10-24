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
  // Base de datos propia de la app (Postgres, tabla "usuarios") para cruzar con Idira
  databaseUrl: env.DATABASE_URL || '',
  openBrowser: !env.NO_OPEN,
  idira: {
    tenantUrl: (env.IDIRA_TENANT_URL || '').replace(/\/$/, ''),
    tenantId: env.IDIRA_TENANT_ID || '',
  },
  saml: {
    // Datos que entrega Idira al crear la app SAML
    idpSsoUrl: env.SAML_IDP_SSO_URL || '',
    idpIssuer: env.SAML_IDP_ISSUER || '',
    idpCertFile: env.SAML_IDP_CERT_FILE ? path.resolve(__dirname, '../..', env.SAML_IDP_CERT_FILE) : '',
  },
  paths: {
    views: path.resolve(__dirname, '../../frontend/views'),
    public: path.resolve(__dirname, '../../frontend/public'),
  },
};

config.isHttps = config.baseUrl.startsWith('https://');

// Datos que la app (SP) entrega a Idira
config.saml.spEntityId = env.SAML_SP_ENTITY_ID || `${config.baseUrl}/auth/saml/metadata`;
config.saml.acsUrl = `${config.baseUrl}/auth/saml/acs`;
config.saml.metadataUrl = `${config.baseUrl}/auth/saml/metadata`;
config.saml.missing = Object.entries({ SAML_IDP_SSO_URL: config.saml.idpSsoUrl, SAML_IDP_CERT_FILE: config.saml.idpCertFile })
  .filter(([, v]) => !v)
  .map(([k]) => k);
config.saml.configured = config.saml.missing.length === 0;
config.idira.missing = Object.entries({ IDIRA_TENANT_URL: config.idira.tenantUrl, IDIRA_TENANT_ID: config.idira.tenantId })
  .filter(([, v]) => !v)
  .map(([k]) => k);
config.idira.configured = config.idira.missing.length === 0;

if (!config.baseUrl || !config.sessionSecret) {
  console.error('Faltan BASE_URL o SESSION_SECRET en .env');
  process.exit(1);
}

module.exports = config;
