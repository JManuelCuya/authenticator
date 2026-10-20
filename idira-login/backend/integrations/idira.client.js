// Cliente HTTP de la API de autenticación de Idira Workforce (antes CyberArk Identity)
//   POST /Security/StartAuthentication    -> inicia el login de un usuario y devuelve los desafíos
//   POST /Security/AdvanceAuthentication  -> responde cada desafío (contraseña, OTP, push...)
const config = require('../config');

class IdiraError extends Error {}

async function call(host, path, body) {
  let res;
  try {
    res = await fetch(`${host}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IDAP-NATIVE-CLIENT': 'true',
        'X-CENTRIFY-NATIVE-CLIENT': 'true',
      },
      body: JSON.stringify({ TenantId: config.idira.tenantId, ...body }),
    });
  } catch (err) {
    throw new IdiraError(`No se pudo conectar con Idira (${host}): ${err.message}`);
  }
  if (!res.ok) throw new IdiraError(`Idira respondió HTTP ${res.status}`);

  const data = await res.json();
  if (!data.success) throw new IdiraError(data.Message || 'Idira rechazó la solicitud');
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

module.exports = { startAuthentication, advanceAuthentication, IdiraError };
