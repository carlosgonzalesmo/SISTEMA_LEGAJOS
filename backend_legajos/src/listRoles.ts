import { prisma } from './prisma';

async function main() {
  const roles = await prisma.rol.findMany();
  console.log(JSON.stringify(roles, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });