# Backend Legajos API

Backend Node.js/Express para gestión de legajos físicos, con autenticación JWT, workflow de solicitudes/devoluciones, auditoría de tenencia y eventos en tiempo real vía Socket.IO.

## Estado real del proyecto

Este repositorio contiene **solo backend** (no frontend). La API está en `backend_legajos/` y hoy incluye:

- API REST bajo `/api/*`.
- Rutas legacy y rutas nuevas agrupadas por dominio (`/api/admin/*` y `/api/sysadmin/*`).
- Importación de legajos desde **Google Sheets**, **Excel (.xlsx)** y **CSV**.
- Prisma + PostgreSQL como persistencia.
- Tests unitarios/Jest para lógica de importación.

## Stack técnico

- Node.js + Express 5 + TypeScript
- Prisma ORM + PostgreSQL
- JWT (`jsonwebtoken`) + `bcryptjs`
- Validación con Zod
- Socket.IO
- Multer + `xlsx` + `csv-parse`

## Estructura principal

```text
backend_legajos/
├─ src/
│  ├─ routes/         # auth, usuarios, roles, legajos, workflow, imports, settings
│  ├─ services/       # lógica de negocio (legajos, usuarios, import, etc.)
│  ├─ middleware/     # auth, roles, manejo de errores
│  ├─ lib/            # utilidades (logger, normalización legajo)
│  ├─ app.ts          # app Express y middlewares globales
│  └─ index.ts        # arranque HTTP + Socket.IO + seed inicial
├─ prisma/schema.prisma
├─ __tests__/         # pruebas Jest (import.service / preview)
└─ docker-compose.yml # PostgreSQL local
```

## Variables de entorno

Usa `.env.example` como base.

Obligatorias:

- `DATABASE_URL`
- `JWT_SECRET`

Comunes:

- `PORT` (default: `3001`)
- `CORS_ORIGIN` (default: `http://localhost:5000`)
- `AUTO_SEED_ADMIN`
- `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`

Para import Google Sheets:

- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_RANGE`
- `GOOGLE_SHEETS_CREDENTIALS_BASE64`
- `IMPORT_ROW_LIMIT`
- `IMPORT_COOLDOWN_MINUTES`

## Instalación y ejecución local

1. Instalar dependencias:

```bash
cd backend_legajos
npm ci
```

2. Levantar PostgreSQL local:

```bash
docker compose up -d
```

3. Configurar entorno:

```bash
cp .env.example .env
# editar valores reales
```

4. Generar cliente Prisma y aplicar esquema (según tu flujo):

```bash
npx prisma generate
npx prisma db push
```

5. Levantar backend en desarrollo:

```bash
npm run dev
```

## Scripts disponibles

- `npm run dev` → desarrollo con `ts-node-dev`
- `npm run build` → compila TypeScript a `dist/`
- `npm start` → ejecuta `node dist/index.js`
- `npm run seed:admin` → crea/actualiza sysadmin
- `npm test` → ejecuta tests Jest
- `npm run test:watch` → tests en modo watch

## Arquitectura de rutas

### Base

- Health: `GET /`
- API: `/api/*`

### Rutas legacy (compatibilidad)

- `/api/auth`
- `/api/usuarios`
- `/api/roles`
- `/api/legajos`
- `/api/archivos`
- `/api/workflow`
- `/api/settings`
- `/api/import` (excel)
- `/api/import-csv`

### Rutas agrupadas (actual)

- `/api/admin/*` (dominio operativo)
  - `legajos`, `archivos`, `workflow`, `import`
- `/api/sysadmin/*` (gobernanza)
  - `usuarios`, `roles`, `settings`

> Nota: Las rutas legacy siguen montadas para no romper consumidores existentes.

## Modelos de datos (Prisma)

Modelos principales:

- `Usuario`, `Rol`
- `Legajo`, `Archivo`
- `Solicitud`, `SolicitudLegajo`
- `Prestamo`
- `Devolucion`, `DevolucionLegajo`
- `LegajoHolderHistory`
- `LegajoRecoveryHistory`
- `SystemSetting`

## Roles y acceso

Roles base esperados:

- `admin`
- `user`
- `sysadmin`

Comportamiento implementado:

- `sysadmin` gobierna usuarios/roles/settings.
- `admin` opera legajos/workflow/importaciones administrativas.
- `user` participa en flujo operativo permitido (p. ej. solicitudes/devoluciones según endpoint).
- Existen guards por endpoint y middleware para bloquear acceso indebido (incluyendo restricciones a `sysadmin` en rutas operativas).

## Importaciones

Actualmente hay 3 vías:

1. **Google Sheets** (`/api/admin/import/*`)
   - `POST /sync`
   - `GET /status`
   - `GET /preview`
   - `POST /reset-lastrow`

2. **Excel (.xlsx)** (`/api/import/*`)
   - carga de archivo y preview/commit

3. **CSV** (`/api/import-csv/*`)
   - preview y commit con validaciones de duplicados/campos

## Eventos Socket.IO

El servidor inicializa Socket.IO en el arranque y emite eventos de cambios operativos (legajos, solicitudes, devoluciones y usuarios) para sincronización en tiempo real con el cliente.

## Semillas y arranque seguro

Al iniciar:

- se verifican/crean roles base (`ensureRoles`),
- se evalúa creación de `sysadmin`:
  - si `AUTO_SEED_ADMIN=true`, fuerza seed,
  - si no existe ningún `sysadmin`, ejecuta seed fallback.

## Testing

Sí hay pruebas automatizadas en `__tests__/` (Jest), enfocadas actualmente en utilidades y preview del servicio de importación.

Ejecutar:

```bash
npm test
```

## Licencia

MIT
