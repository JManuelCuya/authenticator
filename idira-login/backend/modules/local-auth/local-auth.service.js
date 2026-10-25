// Login contra la base de datos propia de la app (tabla "usuarios", columna clave_hash).
// No depende de Idira: valida usuario/correo + contraseña directamente en Postgres.
// Las claves se guardan con bcrypt usando la extensión pgcrypto, así se asignan con SQL desde la
// consola de la base (PgWeb/DbGate), sin scripts locales:
//   UPDATE usuarios SET clave_hash = crypt('ClaveNueva', gen_salt('bf')) WHERE usuario = 'luis.arana';
const { getPool } = require('../../integrations/db');

let schemaReady = false;

async function ensureSchema(pool) {
  if (schemaReady) return;
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clave_hash VARCHAR(255)');
  schemaReady = true;
}

// El usuario se identifica solo por su código (columna "codigo", ej. PE0001), sin distinguir mayúsculas.
// Devuelve { user } si las credenciales son válidas, o { error } con un mensaje para mostrar
async function login(codigo, password) {
  const pool = getPool();
  if (!pool) return { error: 'Base de datos no configurada (falta DATABASE_URL)' };
  await ensureSchema(pool);

  const id = String(codigo || '').trim().toLowerCase();
  const clave = String(password || '');
  const { rows } = await pool.query(
    `SELECT codigo, usuario, correo, nombre, rol, activo,
            (clave_hash IS NOT NULL AND clave_hash = crypt($2, clave_hash)) AS clave_ok
       FROM usuarios
      WHERE LOWER(codigo) = $1
      LIMIT 1`,
    [id, clave]
  );
  const u = rows[0];

  if (!u) {
    // Mismo costo que un login real, para no revelar qué usuarios existen
    await pool.query("SELECT crypt($1, gen_salt('bf'))", [clave]);
    return { error: 'Código o contraseña incorrectos.' };
  }
  if (!u.clave_ok) return { error: 'Código o contraseña incorrectos.' };
  if (!u.activo) return { error: 'El usuario está inactivo en la base de la app.' };

  return {
    rol: u.rol,
    user: {
      codigo: u.codigo,
      usuario: u.usuario,
      nombre: u.nombre,
      correo: u.correo,
      metodo: 'Base de datos propia',
      validado: new Date().toISOString(),
    },
  };
}

module.exports = { login };
