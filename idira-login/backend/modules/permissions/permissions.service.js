// Permisos por rol, leídos de la base (tablas roles, permisos, rol_permisos).
// Se consultan en cada petición: un cambio hecho con SQL aplica sin reiniciar ni volver a iniciar sesión.
const { getPool } = require('../../integrations/db');
const { ensureSchema } = require('../../integrations/db.schema');

const norm = (v) => String(v || '').trim().toLowerCase();

// Pantallas que puede ver un rol: [{ codigo, nombre, ruta }]
async function permissionsOf(rol) {
  const pool = getPool();
  if (!pool || !rol) return [];
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT p.codigo, p.nombre, p.ruta
       FROM rol_permisos rp
       JOIN permisos p ON p.codigo = rp.permiso
      WHERE rp.rol = $1
      ORDER BY p.orden, p.nombre`,
    [norm(rol)]
  );
  return rows;
}

async function can(rol, permiso) {
  return (await permissionsOf(rol)).some((p) => p.codigo === permiso);
}

async function getPermission(codigo) {
  const pool = getPool();
  if (!pool) return null;
  await ensureSchema();
  const { rows } = await pool.query('SELECT codigo, nombre, ruta FROM permisos WHERE codigo = $1', [codigo]);
  return rows[0] || null;
}

// Matriz completa para el panel: roles con sus permisos y la lista de permisos
async function matrix() {
  const pool = getPool();
  await ensureSchema();
  const [roles, permisos, asignaciones] = await Promise.all([
    pool.query('SELECT codigo, nombre FROM roles ORDER BY codigo'),
    pool.query('SELECT codigo, nombre, ruta FROM permisos ORDER BY orden, nombre'),
    pool.query('SELECT rol, permiso FROM rol_permisos'),
  ]);
  const tiene = new Set(asignaciones.rows.map((a) => `${a.rol}|${a.permiso}`));
  return {
    permisos: permisos.rows,
    roles: roles.rows.map((r) => ({ ...r, permisos: permisos.rows.map((p) => tiene.has(`${r.codigo}|${p.codigo}`)) })),
  };
}

module.exports = { permissionsOf, can, getPermission, matrix };
