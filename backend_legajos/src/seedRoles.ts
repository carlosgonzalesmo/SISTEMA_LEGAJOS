import { prisma } from './prisma';

async function main() {
  const existing = await prisma.rol.findMany();
  const needed = ['admin','user','sysadmin'].filter(r => !existing.some((e: { nombre: string }) => e.nombre === r));
  if (needed.length === 0) {
    console.log('Roles ya existen, nada que hacer');
    return;
  }
  for (const nombre of needed) {
    await prisma.rol.create({ data: { nombre } });
    console.log(`Rol creado: ${nombre}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });