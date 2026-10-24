// Exporta los usuarios activos de la base de datos propia (Postgres, tabla "usuarios") al CSV que usa
// crear-usuarios.js (escenario de migración a Idira).
//   node scripts/exportar-bd.js                 -> escribe scripts/usuarios.csv
//   node scripts/exportar-bd.js otro-archivo.csv
// Necesita DATABASE_URL en .env. Las claves no se exportan: crear-usuarios.js genera una temporal
// y Idira pide cambiarla en el primer ingreso.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const target = path.resolve(process.argv[2] || path.join(__dirname, 'usuarios.csv'));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env');

  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await db.connect();
  try {
    const { rows } = await db.query('SELECT usuario, correo, nombre FROM usuarios WHERE activo ORDER BY codigo');
    const esc = (v) => (/[",;\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
    const lines = ['usuario,correo,nombre,clave', ...rows.map((u) => [u.usuario, u.correo, u.nombre, ''].map(esc).join(','))];

    fs.writeFileSync(target, lines.join('\n') + '\n');
    console.log(`${rows.length} usuario(s) activo(s) exportados de la tabla usuarios a ${target}`);
    console.log(`Siguiente paso: node scripts/crear-usuarios.js "${target}" --dry-run`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
