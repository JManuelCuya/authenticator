# Pruebas de integración con Idira: 3 escenarios

App: `https://botgv-idira-login.oicwaw.easypanel.host` (login SAML con Idira).
Tenant Idira: `AAW4661`.

En los tres escenarios **la app no cambia**: siempre recibe una respuesta SAML firmada de Idira.
Lo que cambia es **de dónde saca Idira al usuario**. La pantalla de inicio muestra, para cada
login, qué envió Idira (*Datos recibidos de Idira*) y si la app reconoce al usuario en su propia
base (*Usuario en la base de la app*). Esa es la evidencia de cada prueba.

| # | Escenario | Dónde vive el usuario | Cómo llega a Idira |
|---|---|---|---|
| 1 | Active Directory | AD del cliente | Idira Identity Connector (no se migra) |
| 2 | Google Workspace | Google | Directory service de Google (no se migra) |
| 3 | Base de datos propia | Base de la app | Migración al Cloud Directory (script) |

---

## Antes de empezar (común a los 3)

- [ ] La app SAML en Idira apunta al ACS `…/auth/saml/acs` y al Entity ID `…/auth/saml/metadata`.
- [ ] En Easypanel → Entorno, `SAML_IDP_SSO_URL` y `SAML_IDP_ISSUER` tienen el appKey **actual** de la app SAML.
- [ ] La app SAML envía los atributos **Email** y **DisplayName**.
- [ ] Existe un **rol** asignado a la app SAML (pestaña Permissions). Ahí se agregan los usuarios de prueba.
- [ ] Tienes acceso a los **logs** de Easypanel (líneas `[SAML]`).

### Preguntas comunes
1. ¿La app SAML de pruebas es la del appKey `6112ca13…`? ¿Sigue vigente?
2. ¿Qué rol tiene acceso a la app SAML? ¿Cómo se llama y cuál es su ID?
3. ¿Hay una política de MFA para esa app? ¿Qué factor pedirá en las pruebas?
4. ¿Quién tendrá permisos de administrador en el tenant durante las pruebas?

---

## Escenario 1: Active Directory

**Objetivo:** un usuario del AD entra a la app con su usuario y contraseña de siempre, sin migrarlo.

### Qué necesita el cliente (requisitos del Connector)
Fuente: [Idira Identity Connector requirements](https://docs.cyberark.com/setup/latest/en/content/identity/ispss/ispss-identity-connector-requirements.htm)
- Servidor **Windows Server 2016 o superior**, unido al dominio. Recomendado: 8 GB RAM y 2 núcleos.
- **Salida** a internet por **TCP 443** hacia `*.id.cyberark.cloud` y `*.cyberark.cloud`, y por TCP 80 para revisar certificados. No necesita puertos de entrada.
- Una **cuenta de dominio con permiso de lectura** en el AD, para instalar y ejecutar el Connector.
- Administrador local en ese servidor.

### Preguntas para el cliente
1. ¿Ya hay un **Connector instalado** y conectado al tenant? (Idira → Settings → Network → Identity Connectors)
2. Si no: ¿qué **servidor Windows** del dominio se puede usar, y quién lo instala?
3. ¿Qué **dominio** es (por ejemplo `corp.local`) y qué **OU o grupos** se van a exponer a Idira?
4. ¿Cuál es el **usuario de prueba del AD**? ¿Con qué formato se loguea: `usuario@dominio` (UPN) o `DOMINIO\usuario`?
5. ¿Ese usuario (o su grupo) está agregado al **rol de la app SAML**?
6. ¿El correo del usuario en el AD está completo? Lo necesita el atributo **Email**.

### Pasos
1. Verificar en Idira que el Connector esté en línea y que el usuario del AD aparezca en Users.
2. Agregar el usuario o su grupo de AD al rol de la app SAML.
3. Abrir la app → **Ingresar con Idira (SAML)** → loguearse con la cuenta del AD.

### Resultado esperado y evidencia
- Entra a la app. En *Datos recibidos de Idira*, el `nameID` es el usuario del AD.
- Captura de la pantalla de inicio y de la línea `[SAML] {"evento":"login-ok"…}` de los logs.
- Prueba negativa: desactivar el usuario en el AD → ya no puede entrar.

---

## Escenario 2: Google Workspace

**Objetivo:** un usuario de Google Workspace entra a la app con su cuenta de Google.

> **Advertencia de la documentación:** Idira recomienda este método solo para algunos casos y
> pide **contactar a soporte técnico antes de configurarlo**. Además, si Google es el directorio,
> **no** se debe asignar a esos usuarios la app SAML de Google Workspace, porque provoca un bucle
> de redirecciones.
> Fuente: [Add Google Workspace as a directory service](https://docs.cyberark.com/setup/latest/en/content/identity/coreservices/usersroles/add-google-workspace.htm)

### Cómo se configura (lo hace un administrador)
1. Idira: **Settings → Users → Directory Service → Add Google Directory**.
2. **Authorize**, con credenciales de **administrador de Google Workspace**.
3. Guardar. Los usuarios de Google quedan disponibles en Idira.
4. Agregarlos al rol de la app SAML.

### Preguntas para el cliente
1. ¿Tienen **Google Workspace** (dominio corporativo) o son cuentas Gmail? Gmail no sirve.
2. ¿Quién tiene **credenciales de administrador de Google Workspace** para autorizar la conexión?
3. ¿Ya **consultaron a soporte de CyberArk/Idira**, como pide la documentación? ¿O prefieren **federación con Google** (Google como IdP externo por SAML) en lugar de directory service?
4. ¿Cuál es el **usuario de prueba de Google**?
5. ¿Usan la app SAML de Google Workspace en Idira para esos usuarios? Si es así, hay riesgo de bucle.

### Pasos
1. Verificar que el directorio de Google esté agregado y que el usuario de prueba aparezca en Idira.
2. Agregarlo al rol de la app SAML.
3. Abrir la app → **Ingresar con Idira (SAML)** → loguearse con la cuenta de Google.

### Resultado esperado y evidencia
- Entra a la app. El `nameID` o el correo es la cuenta de Google.
- Captura de la pantalla de inicio y de la línea `login-ok` de los logs.

---

## Escenario 3: base de datos propia

**Objetivo:** los usuarios viven en la base de la app, que no es un directorio. Se **migran** al Cloud
Directory de Idira, y después la app los **reconoce** en su base al entrar.

### Base de datos de la app (Postgres en Easypanel)
1. Easypanel → proyecto **botgv** → **+ Servicio → Postgres**, con el nombre `idira-db`.
2. Crea la tabla en la consola SQL del servicio:
   ```sql
   CREATE TABLE usuarios (
     id        SERIAL PRIMARY KEY,
     codigo    VARCHAR(20)  NOT NULL UNIQUE,   -- ej. PE0001
     usuario   VARCHAR(100) NOT NULL UNIQUE,   -- login, ej. luis.arana
     correo    VARCHAR(150) NOT NULL UNIQUE,   -- debe coincidir con el correo en Idira
     nombre    VARCHAR(150) NOT NULL,
     rol       VARCHAR(50)  NOT NULL DEFAULT 'consulta',
     activo    BOOLEAN      NOT NULL DEFAULT TRUE,
     creado_en TIMESTAMP    NOT NULL DEFAULT NOW()
   );
   ```
   Sin columna de contraseña: la autenticación la hace Idira.
3. Inserta los usuarios de prueba:
   ```sql
   INSERT INTO usuarios (codigo, usuario, correo, nombre, rol)
   VALUES ('PE0001', 'luis.arana', 'luis.arana@tudominio.com', 'Luis Arana', 'admin');
   ```
4. En **idira-login → Entorno**, agrega
   `DATABASE_URL=postgres://USUARIO:CLAVE@botgv_idira-db:5432/NOMBRE_BD` y vuelve a implementar.

La primera vez que se abre la página de migración, la app agrega sola dos columnas de seguimiento
a la tabla: `idira_uuid` y `migrado_en`.

### Qué necesita el cliente (para migrar por API)
- **Usuario de servicio** marcado como *Is OAuth confidential client*, en un rol con **User
  Management** y **Role Management**.
- **App OAuth2 Client** con *Client Creds*, un **scope** y en *Allowed REST APIs*
  `CDirectoryService/.*` y `Roles/.*`.
- Fuente: [Configure the SCIM server](https://docs.cyberark.com/developer/latest/en/developer/scim-management/scim-server-configuration/) (mismo patrón de usuario de servicio y app OAuth2).

### Preguntas para el cliente
1. ¿Cuál es el **Application ID** de la app OAuth2 Client y el nombre del **scope**?
2. ¿Cuál es el **usuario de servicio** y su clave? Que la compartan por un canal seguro, no por WhatsApp.
3. ¿Cuál es el **ID del rol** asignado a la app SAML?
4. ¿Cuál es el **sufijo de login** del tenant? (Settings → Customization → Suffix)
5. ¿Qué **usuarios de prueba** migramos? ¿Les llega la clave temporal o la definen ellos?
6. Alternativa sin API: ¿prefieren cargarlos con **Bulk User Import** (CSV) desde el portal?

### Configuración en Easypanel (idira-login → Entorno)
```
IDIRA_API_APP_ID=        (Application ID de la app OAuth2 Client)
IDIRA_API_CLIENT_ID=     (usuario de servicio)
IDIRA_API_CLIENT_SECRET= (clave del usuario de servicio)
IDIRA_API_SCOPE=         (nombre del scope)
IDIRA_API_ROLE_ID=       (rol asignado a la app SAML)
IDIRA_LOGIN_SUFFIX=      (sufijo de login del tenant)
ADMIN_USERS=             (tu login o correo de Idira; puede ser más de uno, separados por coma)
```
Después, **Implementar**.

### Pasos (desde la web, sin scripts ni puertos expuestos)
1. Entra a la app con **Ingresar con Idira (SAML)** usando una cuenta que esté en `ADMIN_USERS`.
2. En el inicio, pulsa **Migrar usuarios a Idira** (`/admin/migracion`).
3. La lista muestra cada usuario de la tabla con su estado: **pendiente**, **migrado** o **inactivo**.
4. Marca los pendientes y pulsa **Migrar seleccionados**. Por cada uno, la app:
   - crea el usuario en Idira (`/CDirectoryService/CreateUser`) con una **clave temporal**, que Idira pide cambiar en el primer ingreso;
   - guarda su `idira_uuid` en la tabla, para que no se migre dos veces;
   - y al final los agrega todos al rol de la app (`/Roles/UpdateRole`).
5. **Copia las claves temporales** de la pantalla de resultado: no se guardan en ningún lado.
6. Cierra sesión y entra con un usuario migrado → cambia la clave → aparece su código y rol.

> Alternativa por terminal: `scripts/exportar-bd.js` + `scripts/crear-usuarios.js` (necesitan acceso a la base desde tu PC).

### Resultado esperado y evidencia
- Entra a la app, y en **Usuario en la base de la app** aparece su **código y rol** (por ejemplo `PE0001 · admin`).
- Captura del resultado de la migración (tapando las claves), de la pantalla de inicio, y de las líneas `[MIGRACION]` y `login-ok` de los logs.
- Repetir la migración del mismo usuario → aparece en *Omitidos* (no se duplica).
- Prueba negativa: un usuario de Idira que **no** está en la base → entra, pero aparece *No está registrado*.

---

## Login con la base de la app (sin Idira)

Además de SAML y del formulario contra Idira, el login tiene el botón **"Ingresar con la base de la app"**.
Ese botón valida el usuario (o correo) y la contraseña directamente en la tabla `usuarios` de Postgres.
Sirve para comparar el login propio con el login delegado a Idira.

- La contraseña se guarda como **hash bcrypt** (extensión `pgcrypto` de Postgres) en la columna
  `clave_hash`. Nunca se guarda en texto plano.
- Todo se hace en la nube: las claves se asignan con SQL desde la consola de `idira-db`, sin scripts
  ni tu PC.
- Los usuarios **inactivos** o **sin clave asignada** no pueden entrar.
- Tras **5 intentos fallidos** en 15 minutos (misma IP y usuario), se bloquea por 15 minutos.
- Los eventos quedan en los logs como `[LOCAL]` (`login-ok`, `login-fallido`, `login-bloqueado`).

### Preparar la tabla (una sola vez, en PgWeb de idira-db)
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clave_hash VARCHAR(255);
```
La app también lo intenta sola en el primer login, pero conviene hacerlo antes.

### Asignar o cambiar la contraseña de un usuario (en PgWeb)
```sql
UPDATE usuarios SET clave_hash = crypt('ClaveNueva123', gen_salt('bf')) WHERE usuario = 'luis.arana';
```
Para crear un usuario nuevo ya con clave:
```sql
INSERT INTO usuarios (codigo, usuario, correo, nombre, rol, clave_hash)
VALUES ('PE0005', 'ana.torres', 'ana.torres@tudominio.com', 'Ana Torres', 'consulta',
        crypt('ClaveNueva123', gen_salt('bf')));
```
Para comprobar quién tiene clave (sin ver la clave):
```sql
SELECT codigo, usuario, activo, clave_hash IS NOT NULL AS tiene_clave FROM usuarios ORDER BY codigo;
```

### Prueba
1. Asigna una clave a un usuario de la tabla con el `UPDATE` de arriba.
2. En el login, escribe su usuario (o correo) y la clave → **Ingresar con la base de la app**.
3. En el inicio debe aparecer `metodo: Base de datos propia`, y en *Usuario en la base de la app*, su código y rol.

---

## Caso 1: acceso por rol (roles y permisos en la base)

Los roles y lo que puede ver cada uno viven en **tablas de Postgres**. Se cambian con SQL en PgWeb,
**sin tocar el código ni reimplementar**, y el cambio aplica en la siguiente petición.

| Rol | Pantallas (permisos) |
|---|---|
| `admin` | **Panel alumno** (`panel_alumno`) y **Panel docente** (`panel_docente`) |
| `docente` | **Panel docente** |
| `alumno` | **Panel alumno** |

- Tablas: `roles`, `permisos` (cada permiso es una pantalla con su ruta) y `rol_permisos` (qué ve cada rol).
- `usuarios.rol` guarda el código del rol.
- El **inicio** muestra solo los botones de los permisos del rol. Abrir una pantalla sin permiso → **"Sin acceso"** (403).
- La app crea las tablas sola al arrancar y, en una base vacía, carga estos valores por defecto.
- El rol se toma de la tabla `usuarios`. También funciona si el usuario entra con Idira (SAML o API),
  siempre que su correo o usuario coincida con la tabla.

### Script SQL: [`sql/roles-permisos.sql`](sql/roles-permisos.sql)
Pégalo completo en la consola SQL de `idira-db` (PgWeb). El script:
1. Crea las tablas si no existen.
2. Quita los permisos de ejemplo anteriores (`listado`, `inventario`, `panel`) y el rol `consulta`.
3. Carga los roles `admin`, `docente` y `alumno`, los permisos `panel_alumno` y `panel_docente`, y sus asignaciones.
4. Deja tres usuarios de prueba con clave: `luis.arana` (admin), `docente.prueba` y `alumno.prueba`. **Cambia las claves antes de ejecutarlo.**
5. Muestra al final cómo quedó todo.

Se puede ejecutar más de una vez: siempre deja el mismo resultado.

### SQL para administrar después
```sql
-- Dar o quitar un permiso a un rol
INSERT INTO rol_permisos (rol, permiso) VALUES ('docente', 'panel_alumno');
DELETE FROM rol_permisos WHERE rol = 'docente' AND permiso = 'panel_alumno';

-- Cambiar el rol de un usuario
UPDATE usuarios SET rol = 'docente' WHERE usuario = 'alumno.prueba';
```
> Una **pantalla nueva** (otro permiso con otra ruta) sí necesita código: su ruta, su vista y
> `requirePermission('codigo')`. Roles y asignaciones nuevas, en cambio, son solo SQL.

### Prueba
1. **admin** → **Ingresar con la base de la app** → ve **Panel alumno** y **Panel docente**, y los dos abren.
2. **docente.prueba** → ve solo **Panel docente**; `/panel-alumno` → **Sin acceso**.
3. **alumno.prueba** → ve solo **Panel alumno**; `/panel-docente` → **Sin acceso**.

---

## Cómo la app cruza al usuario con su base

Busca en la tabla `usuarios` de Postgres (sin distinguir mayúsculas), en este orden:
1. **correo** igual al NameID o al atributo Email.
2. **usuario** o **código** igual al NameID.
3. **usuario sin dominio**: `luis.arana@corp.local` o `CORP\luis.arana` → `luis.arana` (útil con AD).

## Errores frecuentes

| Mensaje / síntoma | Causa probable |
|---|---|
| Idira dice que no tienes acceso a la app | El usuario no está en el rol de la app SAML |
| `Invalid signature` | Cambió el certificado o la app SAML; descargar la metadata de nuevo |
| `audience mismatch` | El Entity ID en Idira no coincide con `…/auth/saml/metadata` |
| `InResponseTo is not valid` | Se inició el login desde el portal de Idira (IdP-initiated) o se reintentó una respuesta vieja |
| Entra, pero aparece *No está registrado* | El NameID o el correo no coinciden con la tabla `usuarios` |
| *Base de datos no configurada* / *No se pudo consultar* | Falta `DATABASE_URL` en Entorno, o el host o la clave están mal |
| `No se pudo obtener el token` | App OAuth2, usuario de servicio o scope mal configurados |
| *Sin acceso* en `/admin/migracion` | Tu login o correo de Idira no está en `ADMIN_USERS` |
| `The user name is already in use` | El usuario ya existe en Idira (creado a mano o desde otro directorio) |
