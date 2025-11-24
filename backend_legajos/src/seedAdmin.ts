import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { config, validateSeedCredentials } from './config';

// Script de seed para garantizar existencia de un usuario sysadmin.
// Buenas prácticas:
//  - Requiere variables ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD definidas (mínimo 8 chars)
//  - No usar contraseñas por defecto en producción.
//  - Idempotente: si existe actualiza nombre, rol y password (rehash) y marca activo.

const ADMIN_EMAIL = config.ADMIN_EMAIL as string;
const ADMIN_NAME = config.ADMIN_NAME as string;
const ADMIN_PASSWORD = config.ADMIN_PASSWORD as string;

async function ensureRole(nombre: string) {
  return prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
}

async function ensureUser(email: string, nombre: string, password: string, rolNombre: string) {
  const role = await ensureRole(rolNombre);
  const existing = await prisma.usuario.findUnique({ where: { email } });
  const hash = await bcrypt.hash(password, 10);
  if (!existing) {
    const created = await prisma.usuario.create({ data: { email, nombre, password: hash, rolId: role.id } });
    console.log(`Usuario creado: ${email} (rol=${rolNombre}) id=${created.id}`);
    return created;
  } else {
    // Optionally update role and password if needed
    // Cast a any para incluir campo activo si Prisma types no lo exponen correctamente tras migraciones
    const updated = await (prisma.usuario as any).update({ where: { id: existing.id }, data: { nombre, password: hash, rolId: role.id, activo: true } });
    console.log(`Usuario actualizado: ${email} (rol=${rolNombre}) id=${updated.id}`);
    return updated;
  }
}

async function main() {
  try {
    validateSeedCredentials();
  } catch (e) {
    console.error('[seedAdmin] Error de validación de credenciales:', (e as Error).message);
    process.exit(1);
  }
  console.log('[seedAdmin] Creando/verificando roles base...');
  await ensureRole('admin');
  await ensureRole('user');
  await ensureRole('sysadmin');
  console.log('[seedAdmin] Asegurando usuario sysadmin...');
  await ensureUser(ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, 'sysadmin');
  console.log('[seedAdmin] Seed completado.');
}

main().catch(e => { console.error('[seedAdmin] Error no controlado:', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });