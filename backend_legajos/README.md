# Backend Legajos API

Backend oficial para el sistema de gestión de legajos (`applegajos`). Provee API REST + eventos en tiempo real (Socket.IO), auditorías de tenencia y recuperación, y un flujo completo de solicitudes / préstamos / devoluciones. Reemplaza el almacenamiento KV/localStorage por PostgreSQL + Prisma y añade trazabilidad.

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
ADMIN_EMAIL=sysadmin@test.com
ADMIN_NAME=SysAdmin
ADMIN_PASSWORD=sys123
AUTO_SEED_ADMIN=false
```

## Modelos principales (Prisma)

| Modelo | Propósito | Notas |
|--------|-----------|-------|
| `Usuario` | Cuentas con rol (`admin`, `sysadmin`, `user`) y estado activo/inactivo | Relación con legajos creados y auditorías |
| `Rol` | Tabla de roles (sembrada automáticamente) | `sysadmin` restringido del workflow operativo |
| `Legajo` | Archivo físico con código normalizado (`L-0001`) y estado | Estados: `available`, `requested`, `on-loan`, `pending-return`, `blocked` |
| `Solicitud` | Petición de uno o varios legajos | Estados: `PENDING`, `APPROVED`, `COMPLETED`, `REJECTED` |
| `Prestamo` | Representa tenencia activa (derivado de confirmación de solicitud) | Status: `ACTIVE`, `PENDING_RETURN`, `RETURNED` |
| `Devolucion` | Proceso de regreso de legajos | Estados: `PENDING_RETURN`, `RETURNED` |
| `LegajoHolderHistory` | Auditoría de titular (inicio / fin) | Duración calculable en frontend |
| `LegajoRecoveryHistory` | Auditoría de desbloqueos con motivo | Generado en `POST /legajos/:id/unlock` |

Estados de `Legajo` se actualizan en cada transición del workflow y se emiten en tiempo real (`legajo:updated`).

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
| GET | /api/legajos | Listar con filtros (estado, usuario, búsqueda, paginación) |
| GET | /api/legajos/:id | Obtener legajo |
| GET | /api/legajos/by-codigo/:codigo | Buscar por código flexible (normaliza padding) |
| POST | /api/legajos | Crear (normaliza código a 4 dígitos) |
| PUT | /api/legajos/:id | Actualizar (impide cambio de código si está en préstamo) |
| DELETE | /api/legajos/:id | Eliminar |
| POST | /api/legajos/:id/unlock | Desbloquear (admin) y registrar motivo en auditoría |
| GET | /api/legajos/:id/holder-history | Auditoría de titulares (admin) |
| GET | /api/legajos/:id/recoveries | Auditoría de recuperaciones (admin) |

### Archivos (protegido)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/archivos | Registrar archivo asociado a legajo |
| DELETE | /api/archivos/:id | Eliminar archivo |

### Workflow (solicitudes / devoluciones)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/workflow/solicitudes | Crear solicitud (user/admin) |
| GET | /api/workflow/solicitudes | Listar solicitudes |
| POST | /api/workflow/solicitudes/:id/prepare | Preparar (marca encontrados / bloqueados) (admin) |
| POST | /api/workflow/solicitudes/:id/confirm-receipt | Confirmar recepción (user) -> genera tenencia |
| POST | /api/workflow/devoluciones | Iniciar devolución (user/admin) |
| GET | /api/workflow/devoluciones | Listar devoluciones |
| POST | /api/workflow/devoluciones/:id/confirm | Confirmar devolución (admin) |
| POST | /api/workflow/clear | Limpiar transacciones (admin) |

Transiciones emiten eventos Socket.IO para sincronización en tiempo real.

## Eventos en Tiempo Real (Socket.IO)

| Evento | Payload | Disparador |
|--------|---------|-----------|
| `legajo:created` | Legajo | Creación |
| `legajo:updated` | Legajo | Cualquier cambio de estado / edición / unlock |
| `legajo:deleted` | `{ id }` | Eliminación |
| `solicitud:created` | Solicitud | Creación solicitud |
| `solicitud:updated` | Solicitud | Preparación / aprobación / recepción |
| `devolucion:created` | Devolución | Inicio devolución |
| `devolucion:updated` | Devolución | Confirmación devolución |
| `workflow:cleared` | `{ ok: true }` | Limpieza administrativa |
| `user:created` | Usuario | Creación usuario |
| `user:updated` | Usuario | Cambios rol / habilitar / deshabilitar |

El cliente renueva autenticación del socket si cambia el JWT.

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
4. Ejecutar servidor:
```bash
npm run dev
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

## Seguridad y Validaciones
- Zod en entradas críticas (`unlock`, creación/edición legajo, preparación solicitud).
- Restricción sysadmin en rutas operativas (middleware `denySysadmin`).
- Protección último admin activo al modificar roles.
- Motivo de desbloqueo obligatorio (2–500 caracteres) auditado.

## Próximas mejoras
- Permisos más granulares (por recurso y acción)
- Paginación avanzada (cursor / filtros combinados)
- Refresh tokens y rotación
- Logs estructurados + métricas Prometheus
- Exportación de auditorías (CSV / JSON)
- Bulk update / acciones masivas

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
| Unlock legajo | ✓ (estado bloqueado) | ✗ | ✗ |
| Ver auditoría titulares | ✓ | ✗ | ✗ |
| Ver auditoría recuperaciones | ✓ | ✗ | ✗ |

Reglas clave:
1. Gestión de usuarios (listar, crear, cambio de rol, habilitar/deshabilitar) es exclusiva de sysadmin.
2. Último admin activo no puede cambiarse de rol ni deshabilitarse (protección aplicada cuando un sysadmin intenta modificarlo).
3. Sysadmin obtiene 403 en rutas de legajos y workflow.
4. Validaciones consistentes (Zod + mensajes traducibles).
5. Purge masivo elimina workflow, legajos y usuarios; por defecto mantiene al sysadmin que lo ejecuta.

## Integración Frontend
El frontend utiliza hooks (`useLegajos`, `useWorkflow`, `useAuth`) y suscripciones Socket.IO para mantener estado reactivo.

Cada cambio relevante emite un evento y el cliente actualiza caches sin recargar toda la página.

Header requerido en peticiones:
```
Authorization: Bearer <token>
```

Errores devuelven `{ error: <mensaje> }` normalizado para mostrar toasts.

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

Recomendación: Configura una base de datos separada para tests (`DATABASE_URL_TEST`) y ajusta Jest para aislar datos de producción.

### Auto-seeding en arranque (opcional)
Si defines `AUTO_SEED_ADMIN=true` en tu entorno al iniciar el backend, éste importará dinámicamente `seedAdmin.ts` y recreará (o actualizará) el usuario sysadmin con las credenciales provistas en `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD`.

Fallback automático: incluso si `AUTO_SEED_ADMIN` es `false`, el servidor comprobará si existe algún usuario con rol `sysadmin`. Si no encuentra ninguno, ejecutará el seed de forma automática (una sola vez) para garantizar que siempre puedas recuperar acceso administrativo. Esto evita quedarte bloqueado tras un purge o una base nueva sin necesidad de activar la bandera.

Logs esperados al arrancar con auto-seeding activo:
```
AUTO_SEED_ADMIN=true detectado. Ejecutando seedAdmin...
Usuario creado: sysadmin@test.com (rol=sysadmin) id=...
Seed admin/sysadmin completado (o actualizado).
```

Seguridad / buenas prácticas:
- Activa `AUTO_SEED_ADMIN` solo para el primer despliegue o recuperación; luego ponlo en `false`.
- Si lo dejas en `false` y ya existe un sysadmin, no se ejecuta seed; si no existe, se hace seed por fallback.
- Cambia la contraseña por defecto y almacénala en un gestor seguro.
- Si `AUTO_SEED_ADMIN` permanece `true`, cualquier arranque volverá a sobrescribir la contraseña del usuario sysadmin con el valor de la variable de entorno.
- En entornos CI/CD puedes usar el script independiente: `npm run seed:admin` (tras compilar usar `node dist/seedAdmin.js`).

Scripts disponibles:
```
npm run seed:admin   # Desarrollo (ts-node-dev)
```

En producción (después de `npm run build`):
```
node dist/seedAdmin.js
```

## Auditorías
- Titulares: inicio/fin de cada período de préstamo; usado para calcular duración visible.
- Recuperaciones: cada desbloqueo con usuario y motivo.

## Tests
Cobertura inicial con Jest/Supertest: auth, acceso, desbloqueo. Extender a workflow completo y edge cases de paginación.

## Licencia
MIT
