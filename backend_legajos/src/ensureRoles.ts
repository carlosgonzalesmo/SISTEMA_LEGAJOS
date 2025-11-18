import { prisma } from './prisma';

const CORE_ROLES = ['admin','user','sysadmin'];

export async function ensureRoles() {
  for (const nombre of CORE_ROLES) {
    await prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
}