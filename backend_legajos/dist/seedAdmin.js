"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("./prisma");
const config_1 = require("./config");
// Script de seed para garantizar existencia de un usuario sysadmin.
// Buenas prácticas:
//  - Requiere variables ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD definidas (mínimo 8 chars)
//  - No usar contraseñas por defecto en producción.
//  - Idempotente: si existe actualiza nombre, rol y password (rehash) y marca activo.
const ADMIN_EMAIL = config_1.config.ADMIN_EMAIL;
const ADMIN_NAME = config_1.config.ADMIN_NAME;
const ADMIN_PASSWORD = config_1.config.ADMIN_PASSWORD;
async function ensureRole(nombre) {
    return prisma_1.prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
}
async function ensureUser(email, nombre, password, rolNombre) {
    const role = await ensureRole(rolNombre);
    const existing = await prisma_1.prisma.usuario.findUnique({ where: { email } });
    const hash = await bcryptjs_1.default.hash(password, 10);
    if (!existing) {
        const created = await prisma_1.prisma.usuario.create({ data: { email, nombre, password: hash, rolId: role.id } });
        console.log(`Usuario creado: ${email} (rol=${rolNombre}) id=${created.id}`);
        return created;
    }
    else {
        // Optionally update role and password if needed
        // Cast a any para incluir campo activo si Prisma types no lo exponen correctamente tras migraciones
        const updated = await prisma_1.prisma.usuario.update({ where: { id: existing.id }, data: { nombre, password: hash, rolId: role.id, activo: true } });
        console.log(`Usuario actualizado: ${email} (rol=${rolNombre}) id=${updated.id}`);
        return updated;
    }
}
async function main() {
    try {
        (0, config_1.validateSeedCredentials)();
    }
    catch (e) {
        console.error('[seedAdmin] Error de validación de credenciales:', e.message);
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
main().catch(e => { console.error('[seedAdmin] Error no controlado:', e); process.exit(1); }).finally(async () => { await prisma_1.prisma.$disconnect(); });
