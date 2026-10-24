// Pantallas de la app y qué rol (columna "rol" de la tabla usuarios) puede ver cada una.
//   consulta -> Pantalla A
//   admin    -> Pantalla A y Pantalla B
const SCREENS = {
  a: { titulo: 'Pantalla A · Consulta', ruta: '/pantalla-a' },
  b: { titulo: 'Pantalla B · Administración', ruta: '/pantalla-b' },
};

const ROLE_SCREENS = {
  consulta: ['a'],
  admin: ['a', 'b'],
};

const screensOf = (rol) => ROLE_SCREENS[String(rol || '').trim().toLowerCase()] || [];

const canAccess = (rol, key) => screensOf(rol).includes(key);

// Pantallas visibles para el menú: [{ key, titulo, ruta }]
const menuFor = (rol) => screensOf(rol).map((key) => ({ key, ...SCREENS[key] }));

module.exports = { SCREENS, canAccess, menuFor };
