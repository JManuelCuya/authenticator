// Lógica SAML (la app actúa como Service Provider, Idira como IdP). No depende de Express.
const fs = require('fs');
const { SAML } = require('@node-saml/node-saml');
const config = require('../../config');
const readCertificate = require('../../helpers/certificate');

let saml = null;

function getSaml() {
  if (saml) return saml;
  if (!config.saml.configured) throw new Error(`SAML no configurado. Faltan en .env: ${config.saml.missing.join(', ')}`);
  if (!fs.existsSync(config.saml.idpCertFile)) throw new Error(`No existe el certificado del IdP: ${config.saml.idpCertFile}`);

  saml = new SAML({
    entryPoint: config.saml.idpSsoUrl,
    issuer: config.saml.spEntityId,
    callbackUrl: config.saml.acsUrl,
    idpCert: readCertificate(config.saml.idpCertFile),
    idpIssuer: config.saml.idpIssuer || undefined,
    audience: config.saml.spEntityId,
    // Exige una firma válida en la respuesta o en la aserción (la que Idira firme)
    wantAuthnResponseSigned: false,
    wantAssertionsSigned: false,
    // Solo se aceptan respuestas a solicitudes iniciadas por esta app
    validateInResponseTo: 'always',
    identifierFormat: null,
    // Sin exigir un AuthnContext concreto: Idira aplica su propia política (contraseña, MFA...)
    disableRequestedAuthnContext: true,
    acceptedClockSkewMs: 5 * 60 * 1000,
  });
  return saml;
}

// URL de Idira a la que se redirige al usuario para autenticarse
const getLoginUrl = () => getSaml().getAuthorizeUrlAsync('', undefined, {});

// Valida la respuesta firmada que Idira envía al ACS y devuelve los datos del usuario
async function handleAcs(body) {
  const { profile } = await getSaml().validatePostResponseAsync(body);
  if (!profile) throw new Error('Idira no envió un perfil de usuario');

  const attr = (...names) => {
    for (const n of names) {
      const v = profile[n] ?? (profile.attributes || {})[n];
      if (v) return Array.isArray(v) ? v[0] : v;
    }
    return undefined;
  };

  return {
    usuario: profile.nameID,
    nombre: attr('DisplayName', 'displayName', 'name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'),
    correo: attr('Email', 'Email Address', 'email', 'mail', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
    metodo: 'SAML',
    validado: new Date().toISOString(),
  };
}

// Metadata del SP: se puede cargar directo en Idira en vez de copiar los datos a mano
function getMetadata() {
  const opts = { issuer: config.saml.spEntityId, callbackUrl: config.saml.acsUrl, idpCert: 'x', entryPoint: 'x', identifierFormat: null };
  const sp = saml || new SAML(opts);
  return sp.generateServiceProviderMetadata(null, null);
}

module.exports = { getLoginUrl, handleAcs, getMetadata };
