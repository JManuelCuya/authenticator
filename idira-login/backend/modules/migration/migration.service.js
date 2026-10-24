// Migración de usuarios de la base propia (tabla "usuarios") al Cloud Directory de Idira.
// Guarda en la tabla el UUID de Idira de cada usuario migrado, así no se duplica en otra corrida.
// Las claves temporales NO se guardan: solo se devuelven una vez para entregarlas al usuario.
const config = require('../../config');
const { getPool } = require('../../integrations/db');
const idiraAdmin = require('../../integrations/idira.admin');

function pool() {
  const p = getPool();
  if (!p) throw new Error('Base de datos no configurada (falta DATABASE_URL)');
  return p;
}

// Columnas de seguimiento de la migración; se agregan solas la primera vez
async function ensureColumns() {
  await pool().query(
    'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS idira_uuid VARCHAR(64), ADD COLUMN IF NOT EXISTS migrado_en TIMESTAMP'
  );
}

async function listUsers() {
  await ensureColumns();
  const { rows } = await pool().query(
    'SELECT codigo, usuario, correo, nombre, rol, activo, idira_uuid, migrado_en FROM usuarios ORDER BY codigo'
  );
  return rows.map((u) => ({
    ...u,
    estado: u.idira_uuid ? 'migrado' : u.activo ? 'pendiente' : 'inactivo',
  }));
}

// Migra los usuarios indicados por código (solo activos y aún no migrados)
async function migrate(codigos) {
  if (!config.idiraApi.configured) throw new Error(`API de Idira no configurada. Faltan: ${config.idiraApi.missing.join(', ')}`);
  await ensureColumns();

  const { rows } = await pool().query(
    `SELECT codigo, usuario, correo, nombre FROM usuarios
      WHERE codigo = ANY($1) AND activo AND idira_uuid IS NULL ORDER BY codigo`,
    [codigos]
  );

  const resultados = [];
  for (const u of rows) {
    const r = { codigo: u.codigo, login: '', correo: u.correo, estado: '', mensaje: '', clave: '' };
    try {
      r.login = idiraAdmin.loginName(u.usuario);
      const clave = idiraAdmin.tempPassword();
      const uuid = await idiraAdmin.createUser({ login: r.login, correo: u.correo, nombre: u.nombre, clave });
      await pool().query('UPDATE usuarios SET idira_uuid = $1, migrado_en = NOW() WHERE codigo = $2', [uuid, u.codigo]);
      Object.assign(r, { estado: 'creado', clave, uuid });
    } catch (err) {
      Object.assign(r, { estado: 'error', mensaje: err.message });
    }
    resultados.push(r);
  }

  // Todos los creados al rol de la app SAML en una sola llamada
  const creados = resultados.filter((r) => r.estado === 'creado');
  if (creados.length && config.idiraApi.roleId) {
    try {
      await idiraAdmin.addUsersToRole(config.idiraApi.roleId, creados.map((r) => r.uuid));
      creados.forEach((r) => { r.mensaje = 'agregado al rol de la app'; });
    } catch (err) {
      creados.forEach((r) => { r.mensaje = `creado, pero no se agregó al rol: ${err.message}`; });
    }
  } else if (creados.length) {
    creados.forEach((r) => { r.mensaje = 'creado; falta IDIRA_API_ROLE_ID para asignarlo a la app'; });
  }

  const omitidos = codigos.filter((c) => !rows.some((u) => u.codigo === c));
  return { resultados, omitidos };
}

module.exports = { listUsers, migrate };
