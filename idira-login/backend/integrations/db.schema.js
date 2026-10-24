// Tablas de roles y permisos de la app. Se crean solas al arrancar (si no existen) y la primera vez
// se cargan los valores por defecto. Después se administran con SQL (PgWeb) sin tocar el código.
//
//   roles         (codigo, nombre)                  admin, consulta
//   permisos      (codigo, nombre, ruta, orden)     listado, inventario, panel  (= pantallas)
//   rol_permisos  (rol, permiso)                    qué pantallas ve cada rol
//
// usuarios.rol guarda el código del rol (roles.codigo).
const { getPool } = require('./db');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS roles (
     codigo VARCHAR(50)  PRIMARY KEY,
     nombre VARCHAR(100) NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS permisos (
     codigo VARCHAR(50)  PRIMARY KEY,
     nombre VARCHAR(100) NOT NULL,
     ruta   VARCHAR(100) NOT NULL,
     orden  INT          NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS rol_permisos (
     rol     VARCHAR(50) NOT NULL REFERENCES roles(codigo) ON DELETE CASCADE,
     permiso VARCHAR(50) NOT NULL REFERENCES permisos(codigo) ON DELETE CASCADE,
     PRIMARY KEY (rol, permiso)
   )`,
];

// Valores por defecto: solo se cargan si la tabla roles está vacía (primera vez), para no
// deshacer los cambios que se hagan después con SQL
const SEED = [
  `INSERT INTO roles (codigo, nombre) VALUES ('admin', 'Administrador'), ('consulta', 'Consulta')`,
  `INSERT INTO permisos (codigo, nombre, ruta, orden) VALUES
     ('listado', 'Listado', '/listado', 1),
     ('inventario', 'Inventario', '/inventario', 2),
     ('panel', 'Panel', '/panel', 3)`,
  `INSERT INTO rol_permisos (rol, permiso) VALUES
     ('admin', 'listado'), ('admin', 'inventario'), ('admin', 'panel'),
     ('consulta', 'listado')`,
];

let ready = null;

function ensureSchema() {
  const pool = getPool();
  if (!pool) return Promise.resolve(false);
  if (!ready) {
    ready = (async () => {
      for (const sql of SCHEMA) await pool.query(sql);
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM roles');
      if (rows[0].n === 0) {
        for (const sql of SEED) await pool.query(sql);
        console.log('Roles y permisos por defecto cargados (admin: listado, inventario, panel; consulta: listado)');
      }
      return true;
    })().catch((err) => {
      ready = null; // se reintenta en la siguiente petición
      throw err;
    });
  }
  return ready;
}

module.exports = { ensureSchema };
