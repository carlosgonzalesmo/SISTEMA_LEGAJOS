import { prisma } from './prisma';

const CORE_ROLES = ['admin', 'user', 'sysadmin'];

export async function ensureRoles(): Promise<{ created: string[]; existing: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  for (const nombre of CORE_ROLES) {
    const already = await prisma.rol.findUnique({ where: { nombre } });
    if (already) {
      existing.push(nombre);
    } else {
      await prisma.rol.create({ data: { nombre } });
      created.push(nombre);
    }
  }
  return { created, existing };
}