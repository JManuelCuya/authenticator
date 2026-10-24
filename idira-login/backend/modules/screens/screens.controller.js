// Pantallas de la app. Quién ve cada una lo define la tabla rol_permisos (ver db.schema.js).
// Los datos de los paneles son de ejemplo: muestran que la pantalla abre según el permiso.
const base = (req, codigo) => ({ user: req.session.user, rol: req.session.rol, codigo });

function panelAlumno(req, res) {
  res.render('screens/panel-alumno', {
    ...base(req, 'panel_alumno'),
    cursos: [
      { curso: 'Matemática I', docente: 'R. Salazar', nota: 15 },
      { curso: 'Programación', docente: 'M. Quispe', nota: 17 },
      { curso: 'Comunicación', docente: 'L. Vargas', nota: 14 },
    ],
  });
}

function panelDocente(req, res) {
  res.render('screens/panel-docente', {
    ...base(req, 'panel_docente'),
    secciones: [
      { curso: 'Programación', seccion: 'A', alumnos: 32 },
      { curso: 'Programación', seccion: 'B', alumnos: 28 },
      { curso: 'Base de datos', seccion: 'A', alumnos: 30 },
    ],
  });
}

module.exports = { panelAlumno, panelDocente };
