// Crea en Idira los usuarios de un CSV y los agrega al rol asignado a la app SAML.
//   node scripts/crear-usuarios.js usuarios.csv            -> crea los usuarios
//   node scripts/crear-usuarios.js usuarios.csv --dry-run  -> solo muestra lo que haría
//
// CSV (separado por , o ;) con cabecera: usuario,correo,nombre,clave
//   usuario: login en Idira. Si no trae @, se le agrega IDIRA_LOGIN_SUFFIX
//   clave:   opcional. Si va vacía se genera una temporal y se pide cambiarla en el primer ingreso
//
// API de Idira usada (token OAuth2 client credentials):
//   POST /oauth2/token/{appId}             -> token de acceso
//   POST /CDirectoryService/CreateUser     -> crea el usuario y devuelve su UUID
//   POST /Roles/UpdateRole                 -> agrega los usuarios creados al rol
// El resultado (UUID, estado y claves generadas) queda en scripts/salida/, que no se sube a git.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const env = process.env;
const tenantUrl = (env.IDIRA_TENANT_URL || '').replace(/\/$/, '');
const api = {
  appId: env.IDIRA_API_APP_ID,
  clientId: env.IDIRA_API_CLIENT_ID,
  clientSecret: env.IDIRA_API_CLIENT_SECRET,
  scope: env.IDIRA_API_SCOPE,
  roleId: env.IDIRA_API_ROLE_ID,
  suffix: env.IDIRA_LOGIN_SUFFIX,
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvFile = args.find((a) => !a.startsWith('--'));

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// --- CSV ---

function parseLine(line, sep) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { cells.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) fail('El CSV no tiene usuarios (se espera una cabecera y al menos una fila)');
  // Excel en español suele exportar con ;
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = parseLine(lines[0], sep).map((h) => h.toLowerCase());
  for (const col of ['usuario', 'correo', 'nombre']) {
    if (!header.includes(col)) fail(`Falta la columna "${col}" en la cabecera del CSV`);
  }
  return lines.slice(1).map((line, i) => {
    const cells = parseLine(line, sep);
    const row = Object.fromEntries(header.map((h, j) => [h, cells[j] || '']));
    return { fila: i + 2, ...row };
  });
}

function toCsv(rows) {
  const cols = Object.keys(rows[0]);
  const esc = (v) => (/[",;\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

// --- Usuarios ---

function loginName(usuario) {
  if (usuario.includes('@')) return usuario;
  if (!api.suffix) fail(`"${usuario}" no tiene @ y falta IDIRA_LOGIN_SUFFIX en .env`);
  return `${usuario}@${api.suffix}`;
}

// Clave temporal que cumple la política típica: mayúscula, minúscula, número y símbolo
function tempPassword() {
  const pick = (chars) => chars[crypto.randomInt(chars.length)];
  const base = crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
  return `${base}${pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}${pick('abcdefghijkmnpqrstuvwxyz')}${pick('23456789')}${pick('#$%&*!?')}`;
}

// --- API de Idira ---

async function post(urlPath, body, token) {
  const res = await fetch(`${tenantUrl}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.Message || data.error_description || `HTTP ${res.status}`);
  }
  return data.Result;
}

async function getToken() {
  const res = await fetch(`${tenantUrl}/oauth2/token/${encodeURIComponent(api.appId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${api.clientId}:${api.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: api.scope }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    fail(`No se pudo obtener el token de Idira: ${data.error_description || data.error || `HTTP ${res.status}`}`);
  }
  return data.access_token;
}

async function main() {
  if (!csvFile) fail('Uso: node scripts/crear-usuarios.js usuarios.csv [--dry-run]');
  if (!fs.existsSync(csvFile)) fail(`No existe el archivo ${csvFile}`);
  if (!tenantUrl) fail('Falta IDIRA_TENANT_URL en .env');

  const usuarios = readCsv(csvFile).map((u) => ({ ...u, login: loginName(u.usuario) }));
  console.log(`${usuarios.length} usuario(s) en ${csvFile}${dryRun ? ' (modo prueba, no se crea nada)' : ''}`);

  if (dryRun) {
    for (const u of usuarios) console.log(`  fila ${u.fila}: ${u.login} | ${u.correo} | ${u.nombre}${u.clave ? '' : ' | clave temporal'}`);
    console.log(api.roleId ? `Se agregarían al rol ${api.roleId}` : 'AVISO: sin IDIRA_API_ROLE_ID no se agregarían al rol de la app');
    return;
  }

  const missing = ['IDIRA_API_APP_ID', 'IDIRA_API_CLIENT_ID', 'IDIRA_API_CLIENT_SECRET', 'IDIRA_API_SCOPE']
    .filter((k) => !env[k]);
  if (missing.length) fail(`Faltan en .env: ${missing.join(', ')}`);

  const token = await getToken();
  const resultados = [];

  for (const u of usuarios) {
    const clave = u.clave || tempPassword();
    const r = { fila: u.fila, usuario: u.login, correo: u.correo, uuid: '', estado: '', mensaje: '', clave_temporal: u.clave ? '' : clave };
    try {
      r.uuid = await post('/CDirectoryService/CreateUser', {
        Name: u.login,
        Mail: u.correo,
        DisplayName: u.nombre,
        Password: clave,
        ConfirmPassword: clave,
        PasswordNeverExpire: false,
        // Si la clave se generó aquí, se obliga a cambiarla en el primer ingreso
        ForcePasswordChangeNext: !u.clave,
        SendEmailInvite: false,
      }, token);
      r.estado = 'creado';
      console.log(`  OK    ${u.login} -> ${r.uuid}`);
    } catch (err) {
      r.estado = 'error';
      r.mensaje = err.message;
      r.clave_temporal = '';
      console.log(`  ERROR ${u.login}: ${err.message}`);
    }
    resultados.push(r);
  }

  const creados = resultados.filter((r) => r.estado === 'creado');
  if (creados.length && api.roleId) {
    try {
      await post('/Roles/UpdateRole', { Name: api.roleId, Users: { Add: creados.map((r) => r.uuid) } }, token);
      creados.forEach((r) => { r.mensaje = 'agregado al rol'; });
      console.log(`${creados.length} usuario(s) agregado(s) al rol ${api.roleId}`);
    } catch (err) {
      creados.forEach((r) => { r.mensaje = `no se agregó al rol: ${err.message}`; });
      console.log(`ERROR al agregar al rol ${api.roleId}: ${err.message}`);
    }
  } else if (creados.length) {
    console.log('AVISO: falta IDIRA_API_ROLE_ID; asigna los usuarios al rol de la app desde el Admin Portal');
  }

  const outDir = path.resolve(__dirname, 'salida');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `resultado-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
  fs.writeFileSync(outFile, toCsv(resultados));
  console.log(`Creados: ${creados.length} | Con error: ${resultados.length - creados.length}`);
  console.log(`Detalle (incluye claves temporales): ${outFile}`);
}

main().catch((err) => fail(err.message));
