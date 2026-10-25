// Cliente HTTP de la API de autenticación de Idira Workforce (antes CyberArk Identity)
//   POST /Security/StartAuthentication    -> inicia el login de un usuario y devuelve los desafíos
//   POST /Security/AdvanceAuthentication  -> responde cada desafío (contraseña, OTP, push...)
const config = require('../config');

class IdiraError extends Error {}

// Log de lo que se envía y se recibe de Idira ([IDIRA-API] en los logs), sin secretos:
// contraseñas, respuestas de MFA (Answer), tokens y cookies se reemplazan por "***"
const SECRET_KEY = /pass|secret|token|cookie|^answer$|^auth$/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => {
      if (SECRET_KEY.test(k) && v != null && typeof v !== 'object') return [k, '***'];
      if (k === 'SessionId' && typeof v === 'string') return [k, `${v.slice(0, 8)}…`];
      return [k, redact(v)];
    })
  );
}

function log(evento, datos) {
  console.log(`[IDIRA-API] ${JSON.stringify({ fecha: new Date().toISOString(), evento, ...datos })}`);
}

async function call(host, path, body) {
  const url = `${host}${path}`;
  const payload = { TenantId: config.idira.tenantId, ...body };
  log('peticion', { url, body: redact(payload) });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IDAP-NATIVE-CLIENT': 'true',
        'X-CENTRIFY-NATIVE-CLIENT': 'true',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    log('sin-conexion', { url, error: err.message });
    throw new IdiraError(`No se pudo conectar con Idira (${host}): ${err.message}`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  log('respuesta', { url, http: res.status, body: data ? redact(data) : text.slice(0, 500) });

  if (!res.ok) throw new IdiraError(`Idira respondió HTTP ${res.status}`);
  if (!data || !data.success) throw new IdiraError((data && data.Message) || 'Idira rechazó la solicitud');
  return data.Result || {};
}

// Devuelve { host, sessionId, challenges }
async function startAuthentication(user) {
  let host = config.idira.tenantUrl;
  let result = await call(host, '/Security/StartAuthentication', { User: user, Version: '1.0' });

  // El tenant puede indicar que el usuario vive en otro "pod": se repite ahí
  if (result.PodFqdn) {
    host = `https://${result.PodFqdn}`;
    result = await call(host, '/Security/StartAuthentication', { User: user, Version: '1.0' });
  }
  if (!result.SessionId) throw new IdiraError('Idira no devolvió una sesión de autenticación');
  return { host, sessionId: result.SessionId, challenges: result.Challenges || [] };
}

// action: 'Answer' (con answer), 'StartOOB' (envía push/correo/SMS) o 'Poll' (consulta si ya aprobó)
function advanceAuthentication(host, sessionId, mechanismId, action, answer) {
  const body = { SessionId: sessionId, MechanismId: mechanismId, Action: action };
  if (answer !== undefined) body.Answer = answer;
  return call(host, '/Security/AdvanceAuthentication', body);
}

module.exports = { startAuthentication, advanceAuthentication, IdiraError, log };
