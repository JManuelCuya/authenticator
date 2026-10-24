# Guía para el administrador de Idira: integración por API para migrar usuarios

**Objetivo:** que la app `https://botgv-idira-login.oicwaw.easypanel.host` pueda **crear usuarios** en
el Cloud Directory de Idira y **asignarlos a la app SAML**, usando la API de Idira con un usuario de servicio.

## Dónde encaja en el proyecto

```
App Custom SAML (appKey 6112ca13…)  →  LOGIN de los usuarios        ✅ ya configurada, NO se toca
Esta guía (usuario de servicio +    →  API para CREAR usuarios      ⬅ lo que falta activar
app OAuth2 Client + scope)              (página /admin/migracion)
```

Primero la API **crea** a los usuarios en Idira y los agrega al rol de la app SAML. Después esos
usuarios **entran** por SAML. Esta guía **no modifica nada de SAML**.

## Base: guía oficial "Configure the SCIM server"

https://docs.cyberark.com/developer/latest/en/developer/scim-management/scim-server-configuration/

Idira explica en esa guía cómo dar acceso por API a un usuario de servicio. El mecanismo (usuario de
servicio + app OAuth2 + scope) es el mismo para cualquier API de Idira. Este proyecto lo usa para
`CDirectoryService` (crear usuarios) y `Roles` (asignarlos a la app).

| Paso de esta guía | Sección de la guía oficial | Diferencia en este proyecto |
|---|---|---|
| 1. Usuario de servicio | *Create a SCIM user* | Ninguna |
| 2. Rol con permisos | *Create a role for the SCIM user* | No hace falta *Vault Management* (es para PAM) |
| 3. App OAuth2 Client | *Add and configure the OAuth2 client application* | Allowed REST APIs: `CDirectoryService/.*` y `Roles/.*` (la guía oficial usa `scim*`) |
| 6. Prueba (opcional) | *Create a bearer token* | Ninguna |
| 4 y 5. Rol de la app SAML y sufijo | (no están en la guía oficial) | Datos propios de este proyecto |

La guía oficial usa los menús del Admin Portal (*Core Services*, *Web Apps*). En el portal nuevo,
esos menús pueden aparecer bajo **Manage → Inventory**.

**Tiempo estimado:** 15 a 20 minutos. **Requisito:** cuenta con rol *System Administrator*.

---

## Paso 1. Crear el usuario de servicio

Es una cuenta técnica: no inicia sesión en el portal, solo la usa la app para pedir un token.

1. Inicia sesión en el **Admin Portal** de Idira con tu cuenta de administrador.
2. Ve a **Core Services → Users → Add User** (en el portal nuevo: **Manage → Inventory → Identities → Users → Add User**).
3. Completa:
   - **Login Name:** `svc-migracion` y elige el **sufijo** del tenant en el desplegable.
   - **Display Name:** `Servicio migración usuarios`
   - **Password / Confirm Password:** una clave segura.
4. En la sección **Status**, marca la casilla **"Is OAuth confidential client"**.
5. Pulsa **Create User**.

**Anota:**
- Login completo (por ejemplo `svc-migracion@sufijo`) → será `IDIRA_API_CLIENT_ID`
- La clave → será `IDIRA_API_CLIENT_SECRET` (entrégala por un canal seguro, no por WhatsApp)

---

## Paso 2. Crear un rol con permisos de administración de usuarios

Sin este paso, la app obtiene el token, pero Idira rechaza la creación de usuarios.

1. Ve a **Core Services → Roles → Add Role** (portal nuevo: **Manage → Inventory → Roles**).
2. **Name:** `Migracion API`. Guarda.
3. Abre el rol y entra a la pestaña **Administrative Rights**. Pulsa **Add** y agrega:
   - **User Management**
   - **Role Management**
4. Entra a la pestaña **Members**, pulsa **Add**, busca `svc-migracion` y agrégalo.
5. Pulsa **Save**.

---

## Paso 3. Crear la app OAuth2 Client

Es la app que entrega el token al usuario de servicio.

1. Ve a **Web Apps → Add Web Apps** (portal nuevo: **Manage → Inventory → Targets → Applications → Add**).
2. Pestaña **Custom** → junto a **OAuth2 Client**, pulsa **Add**.
3. Pestaña **Settings:**
   - **Application ID:** `migracion_api` (sin espacios). → será `IDIRA_API_APP_ID`
   - **Name / Description:** `Migración de usuarios (API)`
4. Pestaña **General Usage:**
   - **Client ID Type:** **Confidential**
   - Marca **"Must be OAuth Client"**
5. Pestaña **Tokens:**
   - En *Auth methods*, marca **Client Creds**.
6. Pestaña **Scope:**
   - Pulsa **Add**.
   - **Name:** `migracion` → será `IDIRA_API_SCOPE`
   - En **Allowed REST APIs**, pulsa **Add** y agrega estas expresiones, una por línea:
     - `CDirectoryService/.*`
     - `Roles/.*`
     - `scim*` (opcional, solo si también se prueba SCIM)
   - Guarda el scope.
7. Pestaña **Permissions:**
   - Pulsa **Add**, busca el rol **`Migracion API`** (Paso 2) y agrégalo.
8. Pulsa **Save**.

---

## Paso 4. Rol que da acceso a la app SAML

Es el rol al que la app agregará a los usuarios migrados para que puedan iniciar sesión.

1. Abre la app SAML de la prueba (appKey `6112ca13-74ce-4def-bf5b-91291cbc4bdb`).
2. Pestaña **Permissions:** revisa qué rol tiene asignado.
   - Si no tiene ninguno: crea un rol `Usuarios App Login` (**Roles → Add Role**) y agrégalo aquí con permiso **Run**.
3. Anota el **nombre** del rol y su **ID**. → será `IDIRA_API_ROLE_ID`
   - El ID suele verse en la **URL del navegador** al abrir el rol. Si no aparece, envía el nombre.

---

## Paso 5. Sufijo de login

Es lo que va después de la `@` en los usuarios del tenant.

- **Settings → Customization → Login Suffix**, o el desplegable de sufijos en **Users → Add User**.
- Anótalo → será `IDIRA_LOGIN_SUFFIX`

---

## Paso 6 (opcional). Probar desde el portal

En la app OAuth2 Client (Paso 3): **Actions → Create Bearer Token**, e ingresa el usuario y la clave
del Paso 1. Si genera el token, la configuración de los Pasos 1 a 3 es correcta.

---

## Qué devolver

| Dato | Ejemplo | Variable en la app |
|---|---|---|
| Application ID (Paso 3) | `migracion_api` | `IDIRA_API_APP_ID` |
| Login del usuario de servicio (Paso 1) | `svc-migracion@sufijo` | `IDIRA_API_CLIENT_ID` |
| Clave del usuario de servicio (Paso 1), **por un canal seguro** | `********` | `IDIRA_API_CLIENT_SECRET` |
| Nombre del scope (Paso 3) | `migracion` | `IDIRA_API_SCOPE` |
| Nombre e ID del rol de la app SAML (Paso 4) | `Usuarios App Login` / `…` | `IDIRA_API_ROLE_ID` |
| Sufijo de login (Paso 5) | `empresa.com` | `IDIRA_LOGIN_SUFFIX` |
| Confirmación de que mi cuenta está en el rol de la app SAML | — | (para entrar como administrador) |

---

## Después (lo hace quien opera la app, no el administrador)

1. **Easypanel → idira-login → Entorno:** agregar las 6 variables de la tabla anterior y
   `ADMIN_USERS` (login o correo de Idira de quien hará la migración). Pulsar **Implementar**.
2. **Probar con Postman** (`postman/`): token → crear un usuario de prueba → agregarlo al rol.
3. **Migrar desde la web:** entrar a la app con SAML → **Migrar usuarios a Idira** → elegir usuarios →
   **Migrar seleccionados** → copiar las claves temporales.
4. **Validar el login:** entrar con un usuario migrado por SAML → cambiar la clave → la app muestra su
   código y rol.
