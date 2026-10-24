-- =====================================================================
--  Roles y permisos de la app: panel_alumno y panel_docente
--  Pegar completo en la consola SQL de idira-db (PgWeb / DbGate).
--  Se puede ejecutar varias veces: deja siempre el mismo resultado.
-- =====================================================================

-- 1. Tablas (la app también las crea sola al arrancar)
CREATE TABLE IF NOT EXISTS roles (
  codigo VARCHAR(50)  PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS permisos (
  codigo VARCHAR(50)  PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  ruta   VARCHAR(100) NOT NULL,
  orden  INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rol_permisos (
  rol     VARCHAR(50) NOT NULL REFERENCES roles(codigo) ON DELETE CASCADE,
  permiso VARCHAR(50) NOT NULL REFERENCES permisos(codigo) ON DELETE CASCADE,
  PRIMARY KEY (rol, permiso)
);

-- 2. Quitar los permisos de ejemplo anteriores (listado, inventario, panel) y el rol consulta
DELETE FROM permisos WHERE codigo IN ('listado', 'inventario', 'panel');
DELETE FROM roles    WHERE codigo = 'consulta';

-- 3. Roles
INSERT INTO roles (codigo, nombre) VALUES
  ('admin',   'Administrador'),
  ('docente', 'Docente'),
  ('alumno',  'Alumno')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 4. Permisos (cada uno es una pantalla de la app; la ruta debe existir en el código)
INSERT INTO permisos (codigo, nombre, ruta, orden) VALUES
  ('panel_alumno',  'Panel alumno',  '/panel-alumno',  1),
  ('panel_docente', 'Panel docente', '/panel-docente', 2)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, orden = EXCLUDED.orden;

-- 5. Qué pantallas ve cada rol
INSERT INTO rol_permisos (rol, permiso) VALUES
  ('admin',   'panel_alumno'),
  ('admin',   'panel_docente'),
  ('docente', 'panel_docente'),
  ('alumno',  'panel_alumno')
ON CONFLICT DO NOTHING;

-- 6. Usuarios de prueba (cambia las claves). Requiere pgcrypto para crypt()/gen_salt().
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clave_hash VARCHAR(255);

-- Administrador (ya existe): ve los dos paneles
UPDATE usuarios SET rol = 'admin', clave_hash = crypt('ClaveAdmin123', gen_salt('bf'))
 WHERE usuario = 'luis.arana';

-- Docente: ve panel_docente
INSERT INTO usuarios (codigo, usuario, correo, nombre, rol, clave_hash)
VALUES ('DO0001', 'docente.prueba', 'docente.prueba@tudominio.com', 'Docente Prueba', 'docente',
        crypt('ClaveDocente123', gen_salt('bf')))
ON CONFLICT DO NOTHING;

-- Alumno: ve panel_alumno
INSERT INTO usuarios (codigo, usuario, correo, nombre, rol, clave_hash)
VALUES ('AL0001', 'alumno.prueba', 'alumno.prueba@tudominio.com', 'Alumno Prueba', 'alumno',
        crypt('ClaveAlumno123', gen_salt('bf')))
ON CONFLICT DO NOTHING;

-- 7. Verificar
SELECT rp.rol, p.nombre AS pantalla, p.ruta
  FROM rol_permisos rp JOIN permisos p ON p.codigo = rp.permiso
 ORDER BY rp.rol, p.orden;

SELECT codigo, usuario, rol, activo, clave_hash IS NOT NULL AS tiene_clave
  FROM usuarios ORDER BY codigo;
