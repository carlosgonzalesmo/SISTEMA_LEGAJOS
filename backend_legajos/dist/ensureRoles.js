"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRoles = ensureRoles;
const prisma_1 = require("./prisma");
const CORE_ROLES = ['admin', 'user', 'sysadmin'];
async function ensureRoles() {
    const created = [];
    const existing = [];
    for (const nombre of CORE_ROLES) {
        const already = await prisma_1.prisma.rol.findUnique({ where: { nombre } });
        if (already) {
            existing.push(nombre);
        }
        else {
            await prisma_1.prisma.rol.create({ data: { nombre } });
            created.push(nombre);
        }
    }
    return { created, existing };
}
