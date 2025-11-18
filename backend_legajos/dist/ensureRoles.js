"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRoles = ensureRoles;
const prisma_1 = require("./prisma");
const CORE_ROLES = ['admin', 'user', 'sysadmin'];
async function ensureRoles() {
    for (const nombre of CORE_ROLES) {
        await prisma_1.prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
    }
}
