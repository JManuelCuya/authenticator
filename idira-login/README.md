# Login web validado por Idira Workforce

Tu app tiene su propia pantalla de login. Cuando el usuario escribe su usuario y contraseña,
**el servidor los envía a Idira** (antes CyberArk Identity) por su API de autenticación.
Idira responde si son válidos. Si su política pide MFA, la app muestra ese paso y también lo
valida con Idira.

```
Navegador ──usuario+contraseña──▶ Tu servidor ──StartAuthentication──▶ Idira
                                              ──AdvanceAuthentication (contraseña)──▶ Idira
                                              ◀── LoginSuccess  |  pide otro factor (MFA)
         ◀── pantalla MFA (código / push) ──┘ ──AdvanceAuthentication (código o Poll)──▶ Idira
         ◀── acceso concedido ◀────────────── LoginSuccess
```

Los usuarios y contraseñas viven **solo en Idira** (o en el AD conectado a Idira). La app no
guarda credenciales.

> Guía de pruebas por escenario (Active Directory, Google Workspace, base de datos propia): [PRUEBAS.md](PRUEBAS.md)

## Login por SAML (Idira como IdP)

Además del formulario (API), la app tiene un botón **"Ingresar con Idira (SAML)"**. Ahí la app
actúa como *Service Provider* (SP): redirige a Idira, el usuario se autentica allí, e Idira
devuelve una respuesta firmada al **ACS URL**.

**Datos que entregas al IdP** (también se ven en `http://localhost:3000/auth/saml/info`):

| Dato | Valor en local |
|---|---|
| ACS URL | `http://localhost:3000/auth/saml/acs` |
| Entity ID (SP) | `http://localhost:3000/auth/saml/metadata` |
| Metadata del SP | `http://localhost:3000/auth/saml/metadata` |
| Binding | HTTP-POST |
| NameID | correo o login name |

**Datos que te devuelve Idira** (en la app SAML, pestaña *Trust*), para poner en `.env`:

| Variable | Qué es |
|---|---|
| `SAML_IDP_SSO_URL` | IdP / Single Sign On URL |
| `SAML_IDP_CERT_FILE` | certificado de firma descargado (por defecto `certs/idira-signing.cer`; vale PEM o DER) |
| `SAML_IDP_ISSUER` | IdP Entity ID / Issuer (opcional, recomendado) |

Funciona en local: es el navegador el que lleva la respuesta de Idira a `localhost`.
Se rechazan respuestas con firma inválida, con otro *audience*, vencidas o reenviadas.

## Estructura

```
idira-login/
├── backend/
│   ├── server.js                 # punto de entrada (levanta el servidor)
│   ├── app.js                    # arma Express: vistas, estáticos, middlewares, módulos
│   ├── config/index.js           # lee .env y expone la configuración
│   ├── integrations/
│   │   └── idira.client.js       # llamadas HTTP a la API de Idira
│   ├── middlewares/
│   │   ├── session.js            # cookie de sesión
│   │   ├── auth.guards.js        # requireAuth, requireGuest, requireFlow, requireMechanism
│   │   ├── viewLocals.js         # variables comunes para las vistas
│   │   └── errorHandler.js       # 404 y manejo de errores
│   ├── helpers/
│   │   ├── asyncHandler.js       # captura errores de controladores async
│   │   ├── mechanisms.js         # nombres legibles de los factores MFA
│   │   └── openBrowser.js        # abre el navegador en local
│   └── modules/
│       ├── auth/                 # /auth/...  login + MFA con Idira (API)
│       │   ├── auth.routes.js
│       │   ├── auth.controller.js
│       │   └── auth.service.js
│       ├── saml/                 # /auth/saml/...  login SAML (ACS, metadata)
│       │   ├── saml.routes.js
│       │   ├── saml.controller.js
│       │   └── saml.service.js
│       └── home/                 # /  área privada
│           ├── home.routes.js
│           └── home.controller.js
└── frontend/
    ├── views/                    # plantillas EJS
    │   ├── partials/ (header, footer)
    │   ├── auth/ (login, mfa-select, mfa-code, mfa-wait)
    │   └── home/ (index)
    └── public/css/styles.css
```

- **routes**: define URLs y qué middlewares aplican.
- **controller**: lee la petición, llama al service y responde (vista o redirección).
- **service**: la lógica (pasos del login con Idira). No depende de Express.
- **integrations**: el único lugar que habla con Idira.

Para un módulo nuevo, crea `backend/modules/<nombre>/` con sus tres archivos y móntalo en `app.js`.

## Uso local

```bash
npm install
npm start          # abre http://localhost:3000
```

Antes completa en `.env`:

| Variable | Valor |
|---|---|
| `IDIRA_TENANT_URL` | URL de tu tenant, sin ruta. Ej. `https://abc1234.id.cyberark.cloud` |
| `IDIRA_TENANT_ID` | ID del tenant. Ej. `ABC1234` |

## Qué configurar en Idira

1. Un **usuario de prueba** (en el Cloud Directory o en el AD conectado por el Connector).
2. En **Settings → Authentication → Authentication Policies** (o en la política asignada al
   usuario), revisa qué factores pide. La app muestra los que Idira devuelva: contraseña,
   OTP, SMS, correo, push, pregunta de seguridad.
3. Si el tenant restringe el login por API o por IP, permite la IP de tu VPS.

> Endpoints usados: `POST /Security/StartAuthentication` y `POST /Security/AdvanceAuthentication`.
> Confirma su vigencia en docs.cyberark.com (sección *Identity APIs → Authentication*) tras el
> rebranding.

## Cargar usuarios en Idira desde un CSV

`scripts/crear-usuarios.js` crea en Idira los usuarios de un CSV y los agrega al rol asignado a
la app SAML, para poder usarlos en el login.

1. En Idira (una sola vez):
   - Un **usuario de servicio** con permisos de administración de usuarios, marcado como
     *Is OAuth confidential client*.
   - Una app web **OAuth2 Client** (Application ID, autenticación *Client Credentials*) con un
     scope que permita `CDirectoryService/.*` y `Roles/.*`, asignada a ese usuario de servicio.
2. Completa en `.env` las variables `IDIRA_API_*` e `IDIRA_LOGIN_SUFFIX` (ver `.env.example`).
3. Copia `scripts/usuarios.ejemplo.csv` como `scripts/usuarios.csv` y completa los usuarios.
   La columna `clave` es opcional: si va vacía se genera una temporal y Idira pide cambiarla
   en el primer ingreso.
4. Prueba sin crear nada y luego ejecútalo:

```bash
node scripts/crear-usuarios.js scripts/usuarios.csv --dry-run
node scripts/crear-usuarios.js scripts/usuarios.csv
```

El detalle (UUID, errores y claves temporales) queda en `scripts/salida/`. Esa carpeta y los CSV
reales no se suben a git. Endpoints usados: `POST /oauth2/token/{appId}`,
`POST /CDirectoryService/CreateUser` y `POST /Roles/UpdateRole`.

## Subir al VPS con Docker (recomendado)

```bash
# En tu PC: empaqueta sin node_modules ni .env y súbelo
tar -czf idira-login.tgz --exclude=node_modules --exclude=.env idira-login
scp idira-login.tgz usuario@IP_DEL_VPS:~

# En el VPS: instala Docker (una sola vez)
curl -fsSL https://get.docker.com | sudo sh

# Configura y levanta
tar -xzf idira-login.tgz && cd idira-login
cp .env.example .env && nano .env      # BASE_URL=https://login.tudominio.com + datos de Idira
sudo docker compose up -d --build
sudo docker compose logs -f            # ver logs
```

El contenedor solo escucha en `127.0.0.1:3000` del VPS. Delante va Nginx con HTTPS
(ver la sección *Nginx + HTTPS* más abajo).

Actualizar: sube el nuevo `.tgz`, descomprímelo encima y ejecuta `sudo docker compose up -d --build`.

## Subir al VPS sin Docker (Ubuntu / Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx

# Copia la carpeta (sin node_modules) al VPS y luego:
cd idira-login
npm install --omit=dev
cp .env.example .env && nano .env     # BASE_URL=https://login.tudominio.com
sudo npm install -g pm2
pm2 start server.js --name idira-login && pm2 save && pm2 startup
```

Nginx + HTTPS (obligatorio: viajan contraseñas). Archivo `/etc/nginx/sites-available/idira-login`:
```nginx
server {
    server_name login.tudominio.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/idira-login /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d login.tudominio.com
```

## Problemas comunes

| Mensaje | Causa |
|---|---|
| `Idira no configurado` | Faltan `IDIRA_TENANT_URL` o `IDIRA_TENANT_ID` en `.env` |
| `fetch failed` | URL del tenant mal escrita, o el servidor no tiene salida a internet |
| `Idira respondió HTTP 4xx` | Tenant ID incorrecto o la API bloqueada por política |
| Mensaje de error de Idira | Usuario o contraseña incorrectos, cuenta bloqueada, etc. (viene de Idira) |

## Notas

- Las sesiones están en memoria: sirve para prueba o demo. En producción usa Redis.
- No subas el `.env` a ningún repositorio.
