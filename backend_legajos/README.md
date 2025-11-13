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
| GET | /api/usuarios | Listar usuarios |
| GET | /api/usuarios/:id | Obtener usuario |
| POST | /api/usuarios | Crear usuario (admin) |
| PUT | /api/usuarios/:id | Actualizar usuario |
| DELETE | /api/usuarios/:id | Eliminar usuario |

### Roles
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/roles | Listar roles |
| POST | /api/roles | Crear rol |

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
3. Sembrar roles base (admin / user) si aún no existen:
```bash
npx ts-node src/seedRoles.ts
```
3. Ejecutar servidor:
```bash
npx ts-node src/index.ts
```

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

## Frontend integración
En el frontend reemplazar llamadas a KV por fetch a estos endpoints incluyendo el header:
```
Authorization: Bearer <token>
```

## Licencia
MIT
