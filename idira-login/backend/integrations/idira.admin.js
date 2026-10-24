// Cliente de la API de administración de Idira (token OAuth2 client credentials):
//   POST /oauth2/token/{appId}             -> token de acceso del usuario de servicio
//   POST /CDirectoryService/CreateUser     -> crea un usuario en el Cloud Directory y devuelve su UUID
//   POST /Roles/UpdateRole                 -> agrega usuarios a un rol (el rol asignado a la app SAML)
const crypto = require('crypto');
const config = require('../config');

class IdiraApiError extends Error {}

let cachedToken = null;

async function getToken() {
  if (cachedToken && cachedToken.expira > Date.now()) return cachedToken.valor;

  const { appId, clientId, clientSecret, scope } = config.idiraApi;
  let res;
  try {
    res = await fetch(`${config.idira.tenantUrl}/oauth2/token/${encodeURIComponent(appId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
    });
  } catch (err) {
    throw new IdiraApiError(`No se pudo conectar con Idira: ${err.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new IdiraApiError(`No se pudo obtener el token de Idira: ${data.error_description || data.error || `HTTP ${res.status}`}`);
  }
  // Se reutiliza hasta 30 s antes de que venza
  cachedToken = { valor: data.access_token, expira: Date.now() + ((Number(data.expires_in) || 300) - 30) * 1000 };
  return cachedToken.valor;
}

async function post(urlPath, body) {
  const token = await getToken();
  const res = await fetch(`${config.idira.tenantUrl}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new IdiraApiError(data.Message || data.error_description || `HTTP ${res.status}`);
  }
  return data.Result;
}

// Login en Idira: si el usuario no trae @, se le agrega el sufijo del tenant
function loginName(usuario) {
  if (usuario.includes('@')) return usuario;
  if (!config.idiraApi.suffix) throw new IdiraApiError(`"${usuario}" no tiene @ y falta IDIRA_LOGIN_SUFFIX`);
  return `${usuario}@${config.idiraApi.suffix}`;
}

// Clave temporal que cumple la política típica: mayúscula, minúscula, número y símbolo
function tempPassword() {
  const pick = (chars) => chars[crypto.randomInt(chars.length)];
  const base = crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
  return `${base}${pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}${pick('abcdefghijkmnpqrstuvwxyz')}${pick('23456789')}${pick('#$%&*!?')}`;
}

// Crea el usuario con clave temporal; Idira pide cambiarla en el primer ingreso. Devuelve el UUID.
function createUser({ login, correo, nombre, clave }) {
  return post('/CDirectoryService/CreateUser', {
    Name: login,
    Mail: correo,
    DisplayName: nombre,
    Password: clave,
    ConfirmPassword: clave,
    PasswordNeverExpire: false,
    ForcePasswordChangeNext: true,
    SendEmailInvite: false,
  });
}

function addUsersToRole(roleId, uuids) {
  return post('/Roles/UpdateRole', { Name: roleId, Users: { Add: uuids } });
}

module.exports = { getToken, loginName, tempPassword, createUser, addUsersToRole, IdiraApiError };
