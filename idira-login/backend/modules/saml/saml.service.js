// Lógica SAML (la app actúa como Service Provider, Idira como IdP). No depende de Express.
const fs = require('fs');
const { SAML } = require('@node-saml/node-saml');
const config = require('../../config');
const readCertificate = require('../../helpers/certificate');

let saml = null;

const CLOCK_SKEW_MS = 5 * 60 * 1000;
// Si la aserción no trae NotOnOrAfter, su ID se recuerda este tiempo
const MAX_ASSERTION_MEMORY_MS = 60 * 60 * 1000;

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
    // Login iniciado por la app (trae InResponseTo y se valida) o desde el portal de Idira
    // (IdP-initiated, sin InResponseTo). El reenvío de respuestas se bloquea en markAssertionUsed.
    validateInResponseTo: 'ifPresent',
    identifierFormat: null,
    // Sin exigir un AuthnContext concreto: Idira aplica su propia política (contraseña, MFA...)
    disableRequestedAuthnContext: true,
    acceptedClockSkewMs: CLOCK_SKEW_MS,
  });
  return saml;
}

// Aserciones ya usadas (ID -> hasta cuándo recordarla). Cada respuesta de Idira sirve una sola vez,
// así una respuesta capturada no se puede reenviar al ACS. En memoria: alcanza con un solo
// contenedor; con varias réplicas habría que guardarlas en Postgres.
const usedAssertions = new Map();

function markAssertionUsed(profile) {
  const assertion = profile.getAssertion().Assertion;
  const id = assertion.$ && assertion.$.ID;
  if (!id) throw new Error('La aserción SAML no tiene ID');

  const now = Date.now();
  for (const [key, expira] of usedAssertions) if (expira <= now) usedAssertions.delete(key);
  if (usedAssertions.has(id)) throw new Error('Respuesta SAML ya utilizada (posible reenvío)');

  const conditions = (assertion.Conditions || [])[0];
  const notOnOrAfter = Date.parse(conditions && conditions.$ && conditions.$.NotOnOrAfter);
  usedAssertions.set(id, (Number.isNaN(notOnOrAfter) ? now + MAX_ASSERTION_MEMORY_MS : notOnOrAfter) + CLOCK_SKEW_MS);
  return id;
}

// URL de Idira a la que se redirige al usuario para autenticarse
const getLoginUrl = () => getSaml().getAuthorizeUrlAsync('', undefined, {});

// Valida la respuesta firmada que Idira envía al ACS y devuelve los datos del usuario
async function handleAcs(body) {
  const { profile } = await getSaml().validatePostResponseAsync(body);
  if (!profile) throw new Error('Idira no envió un perfil de usuario');
  const assertionId = markAssertionUsed(profile);

  const attr = (...names) => {
    for (const n of names) {
      const v = profile[n] ?? (profile.attributes || {})[n];
      if (v) return Array.isArray(v) ? v[0] : v;
    }
    return undefined;
  };

  const user = {
    usuario: profile.nameID,
    nombre: attr('DisplayName', 'displayName', 'name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'),
    correo: attr('Email', 'Email Address', 'email', 'mail', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
    metodo: 'SAML',
    validado: new Date().toISOString(),
  };

  // Lo que envió Idira tal cual, para depurar y para saber con qué atributos se puede cruzar al usuario
  const detalle = {
    // sp-initiated: desde el botón de la app · idp-initiated: desde el portal de Idira
    flujo: profile.inResponseTo ? 'sp-initiated' : 'idp-initiated',
    assertionId,
    issuer: profile.issuer,
    nameID: profile.nameID,
    nameIDFormat: profile.nameIDFormat,
    sessionIndex: profile.sessionIndex,
    inResponseTo: profile.inResponseTo,
    atributos: profile.attributes || {},
  };

  return { user, detalle };
}

// Extrae datos de una respuesta SAML SIN validarla. Solo para registrar por qué falló una validación.
function diagnose(body) {
  try {
    const xml = Buffer.from((body && body.SAMLResponse) || '', 'base64').toString('utf8');
    if (!xml) return { samlResponse: 'vacía' };
    const tag = (name) => (xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([^<]*)</`)) || [])[1];
    const attrOf = (el, name) => (xml.match(new RegExp(`<(?:\\w+:)?${el}\\b[^>]*\\b${name}="([^"]*)"`)) || [])[1];
    return {
      issuer: tag('Issuer'),
      status: attrOf('StatusCode', 'Value'),
      statusMessage: tag('StatusMessage'),
      destination: attrOf('Response', 'Destination'),
      inResponseTo: attrOf('Response', 'InResponseTo'),
      audience: tag('Audience'),
      nameID: tag('NameID'),
      notOnOrAfter: attrOf('Conditions', 'NotOnOrAfter'),
      firmada: /<(?:\w+:)?Signature\b/.test(xml),
    };
  } catch {
    return { samlResponse: 'no se pudo leer' };
  }
}

// Metadata del SP: se puede cargar directo en Idira en vez de copiar los datos a mano
function getMetadata() {
  const opts = { issuer: config.saml.spEntityId, callbackUrl: config.saml.acsUrl, idpCert: 'x', entryPoint: 'x', identifierFormat: null };
  const sp = saml || new SAML(opts);
  return sp.generateServiceProviderMetadata(null, null);
}

module.exports = { getLoginUrl, handleAcs, diagnose, getMetadata };
