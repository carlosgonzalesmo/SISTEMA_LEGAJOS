# Backend Legajos API

Este backend provee una API REST para el frontend `applegajos`, reemplazando el almacenamiento KV/localStorage por PostgreSQL + Prisma.

## Stack
- Node.js + Express + TypeScript
- PostgreSQL (Docker)
- Prisma ORM
- Autenticación JWT (bcrypt para hashing)
- Validaciones con Zod

## Variables de entorno
```
DATABASE_URL=postgresql://usuario:password@localhost:5432/legajosdb?schema=public
JWT_SECRET=cambia-esto-en-produccion
CORS_ORIGIN=http://localhost:5000
```

## Endpoints principales

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/signup | Registro de usuario |
| POST | /api/auth/login  | Login y obtención de JWT |

Payload signup:
```json
{
  "nombre": "Carlos",
  "email": "carlos@example.com",
  "password": "superseguro",
  "rolId": 1
}
```

Respuesta signup/login:
```json
{
  "token": "<jwt>",
  "user": { "id": 1, "nombre": "Carlos", "email": "carlos@example.com", "rolId": 1 }
}
```

### Usuarios (requiere Authorization: Bearer <token>)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/usuarios | Listar usuarios (solo sysadmin) |
| GET | /api/usuarios/:id | Obtener usuario (sysadmin o el propio usuario vía /me) |
| POST | /api/usuarios | Crear usuario (solo sysadmin) |
| PUT | /api/usuarios/:id | Actualizar usuario (sysadmin o self sin cambio de rol) |
| DELETE | /api/usuarios/:id | Eliminar usuario (solo sysadmin) |
| POST | /api/usuarios/purge | Eliminar en bloque usuarios (solo sysadmin; excluye al solicitante salvo includeSelf) |

### Roles
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/roles | Listar roles (solo sysadmin) |
| POST | /api/roles | Crear rol (solo sysadmin) |

### Legajos (protegido)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/legajos | Listar legajos |
| GET | /api/legajos/:id | Obtener legajo |
| POST | /api/legajos | Crear legajo |
| PUT | /api/legajos/:id | Actualizar legajo |
| DELETE | /api/legajos/:id | Eliminar legajo |

### Archivos (protegido)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/archivos | Subir/registrar archivo asociado a legajo |
| DELETE | /api/archivos/:id | Eliminar archivo |

## Uso rápido
1. Iniciar PostgreSQL:
```bash
docker compose up -d
```
2. Generar cliente Prisma (si fuera necesario):
```bash
npx prisma generate
```
3. Sembrar roles base (admin / user / sysadmin) si aún no existen:
```bash
npx ts-node src/seedRoles.ts
```
3. Ejecutar servidor:
```bash
npx ts-node src/index.ts
```

Nota: El servidor ahora asegura automáticamente la existencia de los roles base al iniciar (ver `ensureRoles.ts`). Si faltan, los crea mediante upsert, evitando errores `P2003` al registrar usuarios.

### CORS
El backend expone por defecto `Access-Control-Allow-Origin` apuntando a `http://localhost:5000` (frontend Vite). Puedes cambiarlo con `CORS_ORIGIN`.

Preflight exitoso debe devolver encabezados:
```
Access-Control-Allow-Origin: http://localhost:5000
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
```

## Próximas mejoras
- Roles y permisos más granulares
- Paginación y filtros
- Refresh tokens
- Logs estructurados y métricas
- Tests automatizados (Jest/Supertest)

## Matriz de Acceso (Roles)

| Recurso / Acción | admin | sysadmin | user |
|------------------|:-----:|:-------:|:----:|
| Listar usuarios | ✗ | ✓ | ✗ |
| Crear usuario | ✗ | ✓ | ✗ |
| Cambiar rol usuario | ✗ | ✓ (no último admin) | ✗ |
| Deshabilitar / habilitar usuario | ✗ | ✓ | ✗ |
| Legajos CRUD | ✓ | ✗ | ✓ (lectura) |
| Workflow: crear solicitud | ✓ | ✗ | ✓ |
| Workflow: preparar solicitud | ✓ | ✗ | ✗ |
| Workflow: confirmar recepción | ✗ | ✗ | ✓ |
| Workflow: iniciar devolución | ✓ | ✗ | ✓ |
| Workflow: confirmar devolución | ✓ | ✗ | ✗ |
| Limpiar workflow (/workflow/clear) | ✓ | ✗ | ✗ |
| Crear rol | ✗ | ✓ |
| Audit Log | ✓ | ✗ |
| Purge usuarios (/api/usuarios/purge) | ✗ | ✓ | ✗ |

Reglas clave:
1. Gestión de usuarios (listar, crear, cambio de rol, habilitar/deshabilitar) es exclusiva de sysadmin.
2. Último admin activo no puede cambiarse de rol ni deshabilitarse (protección aplicada cuando un sysadmin intenta modificarlo).
3. Sysadmin obtiene 403 en rutas de legajos y workflow.
4. Validaciones consistentes (Zod + mensajes traducibles).
5. Purge masivo elimina workflow, legajos y usuarios; por defecto mantiene al sysadmin que lo ejecuta.

## Frontend integración
En el frontend reemplazar llamadas a KV por fetch a estos endpoints incluyendo el header:
```
Authorization: Bearer <token>
```

## Recuperación de Credenciales / Usuario SysAdmin

Si las pruebas o un borrado accidental eliminaron usuarios y ahora ningún login funciona (o ejecutaste purge con includeSelf):

1. Ejecuta el script de roles (opcional si ya existen):
  ```bash
  npx ts-node src/seedRoles.ts
  ```
2. Ejecuta el script de recreación de sysadmin:
  ```bash
  ADMIN_EMAIL=sysadmin@test.com ADMIN_NAME=SysAdmin ADMIN_PASSWORD="sys123" npx ts-node src/seedAdmin.ts
  ```
3. Usa esas credenciales (rol sysadmin) para iniciar sesión y crear nuevos usuarios.

Puedes cambiar las variables de entorno para definir correo y contraseña personalizados.

Recomendación: Configura una base de datos separada para tests (ej. `DATABASE_URL_TEST`) y ajusta Jest para usarla, evitando limpiar datos de producción.

## Licencia
MIT
