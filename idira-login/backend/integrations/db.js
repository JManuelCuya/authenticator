// Conexión a la base de datos propia de la app (Postgres). Se crea al primer uso.
const { Pool } = require('pg');
const config = require('../config');

let pool = null;

function getPool() {
  if (!config.databaseUrl) return null;
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl, max: 5, connectionTimeoutMillis: 5000 });
    pool.on('error', (err) => console.error('Postgres:', err.message));
  }
  return pool;
}

module.exports = { getPool };
