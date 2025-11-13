"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./prisma");
async function main() {
    const existing = await prisma_1.prisma.rol.findMany();
    const needed = ['admin', 'user'].filter(r => !existing.some((e) => e.nombre === r));
    if (needed.length === 0) {
        console.log('Roles ya existen, nada que hacer');
        return;
    }
    for (const nombre of needed) {
        await prisma_1.prisma.rol.create({ data: { nombre } });
        console.log(`Rol creado: ${nombre}`);
    }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma_1.prisma.$disconnect(); });
