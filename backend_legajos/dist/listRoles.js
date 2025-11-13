"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./prisma");
async function main() {
    const roles = await prisma_1.prisma.rol.findMany();
    console.log(JSON.stringify(roles, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma_1.prisma.$disconnect(); });
