// Usuarios de la base de datos propia de la app (tabla "usuarios" en Postgres). No guarda contraseñas:
// la autenticación la hace Idira. Sirve para dos cosas:
//   1. Cruzar la identidad que envía Idira con el usuario interno (código, rol...)
//   2. Ser la fuente de la migración a Idira (scripts/exportar-bd.js -> scripts/crear-usuarios.js)
const { getPool } = require('../../integrations/db');

const COLUMNS = 'codigo, usuario, correo, nombre, rol, activo';

const norm = (v) => String(v || '').trim().toLowerCase();

async function list() {
  const pool = getPool();
  if (!pool) throw new Error('Falta DATABASE_URL');
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM usuarios ORDER BY codigo`);
  return rows;
}

// Busca al usuario interno SOLO por su código (columna codigo, sin distinguir mayúsculas):
//   - Login con Idira: el código llega como NameID (Custom Logic con el atributo codigo_app)
//   - Login con la base de la app: la sesión ya trae el código
// El correo y el usuario no se usan para cruzar. Devuelve { usuario, criterio }, null si no está
// registrado, o { error } si la base no responde. Nunca lanza: un problema con la base no debe impedir el login.
async function match({ codigo, usuario } = {}) {
  const pool = getPool();
  if (!pool) return { error: 'Base de datos no configurada (falta DATABASE_URL)' };

  const valor = norm(codigo || usuario);
  if (!valor) return null;

  try {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM usuarios WHERE LOWER(codigo) = $1`, [valor]);
    return rows[0] ? { usuario: rows[0], criterio: 'código' } : null;
  } catch (err) {
    console.error('Postgres:', err.message);
    return { error: `No se pudo consultar la base de datos: ${err.message}` };
  }
}

module.exports = { list, match };
