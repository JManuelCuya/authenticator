// Usuarios de la base de datos propia de la app (tabla "usuarios" en Postgres). No guarda contraseñas:
// la autenticación la hace Idira. Sirve para dos cosas:
//   1. Cruzar la identidad que envía Idira con el usuario interno (código, rol...)
//   2. Ser la fuente de la migración a Idira (scripts/exportar-bd.js -> scripts/crear-usuarios.js)
const { getPool } = require('../../integrations/db');

const COLUMNS = 'codigo, usuario, correo, nombre, rol, activo';

const norm = (v) => String(v || '').trim().toLowerCase();
// "luis.arana@dominio" -> "luis.arana"; "DOMINIO\luis.arana" -> "luis.arana"
const localPart = (v) => norm(v).split('@')[0].split('\\').pop();

async function list() {
  const pool = getPool();
  if (!pool) throw new Error('Falta DATABASE_URL');
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM usuarios ORDER BY codigo`);
  return rows;
}

// Busca al usuario interno a partir de lo que envió Idira (NameID, correo).
// Devuelve { usuario, criterio }, null si no está registrado, o { error } si la base no responde.
// Nunca lanza: un problema con la base no debe impedir el login.
async function match({ usuario, correo } = {}) {
  const pool = getPool();
  if (!pool) return { error: 'Base de datos no configurada (falta DATABASE_URL)' };

  const exactos = [...new Set([usuario, correo].filter(Boolean).map(norm))];
  const sinDominio = [...new Set([usuario, correo].filter(Boolean).map(localPart))];
  if (!exactos.length) return null;

  try {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM usuarios
        WHERE LOWER(correo) = ANY($1) OR LOWER(usuario) = ANY($1) OR LOWER(codigo) = ANY($1)
           OR LOWER(usuario) = ANY($2) OR LOWER(codigo) = ANY($2)`,
      [exactos, sinDominio]
    );

    // Prioridad: correo exacto > usuario o código exacto > usuario sin dominio
    const porCorreo = rows.find((u) => exactos.includes(norm(u.correo)));
    if (porCorreo) return { usuario: porCorreo, criterio: 'correo' };
    const porUsuario = rows.find((u) => exactos.includes(norm(u.usuario)) || exactos.includes(norm(u.codigo)));
    if (porUsuario) return { usuario: porUsuario, criterio: 'usuario o código' };
    if (rows[0]) return { usuario: rows[0], criterio: 'usuario sin dominio' };
    return null;
  } catch (err) {
    console.error('Postgres:', err.message);
    return { error: `No se pudo consultar la base de datos: ${err.message}` };
  }
}

module.exports = { list, match };
