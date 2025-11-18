# Guía de Seeding

Esta guía explica los scripts de seeding disponibles, qué crean y cómo ejecutarlos correctamente en distintos escenarios (desarrollo, recuperación de desastres, pruebas).

## Objetivo de los Seeders
Los seeders inicializan datos mínimos indispensables para que la aplicación funcione sin errores de integridad referencial:
- Roles base: `admin`, `user`, `sysadmin`.
- Usuario administrador inicial (opcional) para recuperar acceso si se borraron usuarios.

## Scripts Disponibles

### 1. `src/ensureRoles.ts`
Se usa internamente al arrancar el servidor (llamado desde `index.ts`). Hace un `upsert` de cada rol en `['admin','user','sysadmin']`. **No crea usuarios.**

### 2. `src/seedRoles.ts`
Uso manual para crear únicamente los roles que falten.
- Si los tres roles ya existen, imprime `Roles ya existen, nada que hacer`.
- Si falta alguno, lo crea.

#### Ejecutar
```powershell
# Desde la carpeta backend_legajos
npx ts-node src/seedRoles.ts
```

### 3. `src/seedAdmin.ts` (ahora crea SysAdmin por defecto)
Recrea (o actualiza) un usuario `sysadmin` (rol con permisos de gestión). También asegura que existan los tres roles.
- Si el usuario (por defecto `sysadmin@test.com`) no existe lo crea con rol `sysadmin`.
- Si existe, actualiza nombre, contraseña, rol y marca `activo: true`.
- Usa variables de entorno para personalizar email, nombre y contraseña.

Variables soportadas:
- `ADMIN_EMAIL`
- `ADMIN_NAME`
- `ADMIN_PASSWORD`

#### Ejecutar (ejemplo PowerShell)
```powershell
$env:ADMIN_EMAIL='sysadmin@test.com'; $env:ADMIN_NAME='SysAdmin'; $env:ADMIN_PASSWORD='sys123'; npx ts-node src/seedAdmin.ts
```

> Nota: En Windows PowerShell usa `;` para separar asignaciones y el comando final. En Linux/macOS puedes usar `&&` o exportar primero.

## Nuevo Endpoint de Purga Masiva
El endpoint `POST /api/usuarios/purge` (solo `sysadmin`) permite eliminar en bloque usuarios y sus datos relacionados. Por defecto conserva al sysadmin que ejecuta la operación; si envías `{ "includeSelf": true }` también lo eliminará (requiere luego re-seeding).

Internamente hace una transacción que elimina en orden:
1. Tablas puente de workflow (`SolicitudLegajo`, `DevolucionLegajo`).
2. `Prestamo`, `Solicitud`, `Devolucion`.
3. `Archivo` relacionados a `Legajo` de los usuarios a purgar.
4. `Legajo` de esos usuarios.
5. Finalmente `Usuario`.

Respuesta:
```json
{ "deleted": <cantidad>, "includeSelf": false }
```

## Flujo Recomendado de Recuperación
Si el sistema se queda sin usuarios con privilegios (sysadmin):
1. Ejecuta `seedRoles.ts` (opcional si ya existen roles).
2. Ejecuta `seedAdmin.ts` con credenciales nuevas (crea sysadmin).
3. Inicia el servidor: se garantizan roles con `ensureRoles.ts` y podrás iniciar sesión como sysadmin.

## Seeding en Entornos de Test
Para evitar interferir con datos de desarrollo/producción:
- Usa una cadena de conexión distinta `DATABASE_URL` apuntando a una base separada (por ejemplo `legajos_test`).
- Ejecuta migraciones (`npx prisma migrate deploy`) antes de los seeders si la base está vacía.
- Corre luego los seeders si tus tests dependen de roles o del usuario admin.

## Buenas Prácticas
- Nunca hardcodees contraseñas de producción en los seeders (usa variables de entorno).
- Documenta cada cambio adicional de datos iniciales en este archivo (`SEEDING.md`).
- Evita usar `includeSelf: true` en producción; deja siempre al menos un sysadmin para gobernanza.
- Controla los logs de seeding en CI para asegurarte de que no se están recreando usuarios inadvertidamente.

## Ejemplo Completo (Setup Rápido)
```powershell
# 1. Migraciones (si aplica)
npx prisma migrate deploy
# 2. Asegurar roles (opcional, el servidor también lo hará)
npx ts-node src/seedRoles.ts
# 3. Crear / actualizar sysadmin inicial
$env:ADMIN_EMAIL='sysadmin@test.com'; $env:ADMIN_PASSWORD='sys123'; npx ts-node src/seedAdmin.ts
# 4. Arrancar servidor
npx ts-node src/index.ts
```

## Preguntas Frecuentes
**¿Por qué tanto énfasis en los roles?** Para evitar errores de clave foránea (`P2003`) cuando un signup referencia un rol inexistente.

**¿Puedo agregar más roles por seeder?** Sí, extiende `seedRoles.ts` agregando nombres al array y ejecuta nuevamente.

**¿Debo borrar roles antes de recrearlos?** No. Se usan `upsert` o comprobaciones para evitar duplicados.

---
Última actualización: Nov 17, 2025
