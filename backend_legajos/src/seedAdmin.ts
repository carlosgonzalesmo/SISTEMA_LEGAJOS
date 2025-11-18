import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// Script para recrear usuario admin (y opcional sysadmin) si faltan.
// Usa credenciales conocidas o variables de entorno.
// Ahora el usuario semilla principal será un sysadmin (rol con capacidad de gestionar usuarios y roles)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sysadmin@test.com';
const ADMIN_NAME = process.env.ADMIN_NAME || 'SysAdmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sys123';

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
  console.log('Recreando roles base...');
  await ensureRole('admin');
  await ensureRole('user');
  await ensureRole('sysadmin');
  console.log('Asegurando usuario sysadmin...');
  await ensureUser(ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, 'sysadmin');
  console.log('Listo.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });