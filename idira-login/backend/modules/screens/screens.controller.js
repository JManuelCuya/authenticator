// Pantallas de la app. Quién ve cada una lo define la tabla rol_permisos (ver db.schema.js).
// Los datos de listado e inventario son de ejemplo: muestran que la pantalla abre según el permiso.
const usersService = require('../users/users.service');
const permissionsService = require('../permissions/permissions.service');

const base = (req, codigo) => ({ user: req.session.user, rol: req.session.rol, codigo });

function listado(req, res) {
  res.render('screens/listado', {
    ...base(req, 'listado'),
    registros: [
      { id: 'SOL-1001', asunto: 'Alta de proveedor', estado: 'Atendida' },
      { id: 'SOL-1002', asunto: 'Cambio de cuenta bancaria', estado: 'Pendiente' },
      { id: 'SOL-1003', asunto: 'Renovación de contrato', estado: 'Atendida' },
    ],
  });
}

function inventario(req, res) {
  res.render('screens/inventario', {
    ...base(req, 'inventario'),
    items: [
      { codigo: 'LAP-014', descripcion: 'Laptop 14"', stock: 12 },
      { codigo: 'MON-024', descripcion: 'Monitor 24"', stock: 30 },
      { codigo: 'TEC-001', descripcion: 'Teclado', stock: 4 },
    ],
  });
}

// Panel de administración: usuarios con su rol y la matriz de roles y permisos
async function panel(req, res) {
  let usuarios = [];
  let matriz = { permisos: [], roles: [] };
  let error = '';
  try {
    [usuarios, matriz] = await Promise.all([usersService.list(), permissionsService.matrix()]);
  } catch (err) {
    error = `No se pudo consultar la base de datos: ${err.message}`;
  }
  res.render('screens/panel', { ...base(req, 'panel'), usuarios, matriz, error });
}

module.exports = { listado, inventario, panel };
