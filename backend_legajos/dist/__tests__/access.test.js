"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const app_1 = require("../src/app");
const prisma_1 = require("../src/prisma");
const auth_1 = require("../src/middleware/auth");
describe('Access Control Matrix', () => {
    let adminToken;
    let sysadminToken;
    let userToken;
    let legajoId;
    let adminId;
    let sysadminRoleId;
    let adminRoleId;
    let userRoleId;
    beforeAll(async () => {
        const adminRole = await prisma_1.prisma.rol.upsert({ where: { nombre: 'admin' }, update: {}, create: { nombre: 'admin' } });
        const userRole = await prisma_1.prisma.rol.upsert({ where: { nombre: 'user' }, update: {}, create: { nombre: 'user' } });
        const sysadminRole = await prisma_1.prisma.rol.upsert({ where: { nombre: 'sysadmin' }, update: {}, create: { nombre: 'sysadmin' } });
        adminRoleId = adminRole.id;
        userRoleId = userRole.id;
        sysadminRoleId = sysadminRole.id;
        const pass = await bcryptjs_1.default.hash('pass123', 10);
        // Upsert users to avoid duplicates when tests re-run
        const admin = await prisma_1.prisma.usuario.upsert({ where: { email: 'admin@test.com' }, update: { rolId: adminRole.id }, create: { nombre: 'Admin', email: 'admin@test.com', password: pass, rolId: adminRole.id } });
        const sysadmin = await prisma_1.prisma.usuario.upsert({ where: { email: 'sys@test.com' }, update: { rolId: sysadminRole.id }, create: { nombre: 'Sys', email: 'sys@test.com', password: pass, rolId: sysadminRole.id } });
        const normal = await prisma_1.prisma.usuario.upsert({ where: { email: 'user@test.com' }, update: { rolId: userRole.id }, create: { nombre: 'User', email: 'user@test.com', password: pass, rolId: userRole.id } });
        adminId = admin.id;
        adminToken = (0, auth_1.signToken)(admin.id);
        sysadminToken = (0, auth_1.signToken)(sysadmin.id);
        userToken = (0, auth_1.signToken)(normal.id);
        const randomCodigo = `A-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        const legajo = await prisma_1.prisma.legajo.create({ data: { codigo: randomCodigo, titulo: 'Legajo A', descripcion: 'Desc', usuarioId: admin.id, estado: 'available' } });
        legajoId = legajo.id;
    });
    // No global cleanup to avoid interfering with other test suites.
    test('Admin can list legajos', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/legajos').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });
    test('Sysadmin cannot list legajos', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/legajos').set('Authorization', `Bearer ${sysadminToken}`);
        expect(res.status).toBe(403);
    });
    test('User can list legajos', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/legajos').set('Authorization', `Bearer ${userToken}`);
        // list returns paged or array depending on implementation; accept 200
        expect(res.status).toBe(200);
    });
    test('Sysadmin cannot create solicitud', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/workflow/solicitudes')
            .set('Authorization', `Bearer ${sysadminToken}`)
            .send({ legajoIds: [legajoId] });
        expect(res.status).toBe(403);
    });
    test('User can create solicitud', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/workflow/solicitudes')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ legajoIds: [legajoId] });
        expect(res.status).toBe(201);
    });
    test('Admin cannot access roles list', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
    });
    test('Sysadmin can access roles list', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${sysadminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    test('Sysadmin can create user', async () => {
        const uniqueEmail = `new+${Date.now()}@test.com`;
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/usuarios')
            .set('Authorization', `Bearer ${sysadminToken}`)
            .send({ nombre: 'NewUser', email: uniqueEmail, password: 'pass123', rolId: userRoleId });
        expect(res.status).toBe(201);
    });
    test('Admin cannot create user', async () => {
        const uniqueEmail = `fail+${Date.now()}@test.com`;
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/usuarios')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ nombre: 'NewUser', email: uniqueEmail, password: 'pass123', rolId: userRoleId });
        expect(res.status).toBe(403);
    });
    test('Admin cannot list usuarios', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
    });
    test('Sysadmin can list usuarios', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${sysadminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    test('Sysadmin cannot downgrade last remaining admin role', async () => {
        // Desactivar cualquier otro admin activo para forzar condición de "último admin"
        const otherAdmins = await prisma_1.prisma.usuario.findMany({ where: { rolId: adminRoleId } });
        for (const a of otherAdmins) {
            if (a.id !== adminId && a.activo !== false) {
                await prisma_1.prisma.usuario.update({ where: { id: a.id }, data: { activo: false } });
            }
        }
        const res = await (0, supertest_1.default)(app_1.app)
            .put(`/api/usuarios/${adminId}`)
            .set('Authorization', `Bearer ${sysadminToken}`)
            .send({ rolId: sysadminRoleId });
        expect(res.status).toBe(400);
        expect(/último administrador|ultimo administrador|No puedes quitar el último administrador/i.test(res.body.error)).toBe(true);
    });
    test('Sysadmin cannot list workflow solicitudes', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get('/api/workflow/solicitudes')
            .set('Authorization', `Bearer ${sysadminToken}`);
        expect(res.status).toBe(403);
    });
    test('Admin cannot purge users', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/usuarios/purge')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});
        expect(res.status).toBe(403);
    });
    test('Sysadmin can purge users except self', async () => {
        // Crear usuario temporal para comprobar borrado
        const tempEmail = `temp+${Date.now()}@test.com`;
        const create = await (0, supertest_1.default)(app_1.app)
            .post('/api/usuarios')
            .set('Authorization', `Bearer ${sysadminToken}`)
            .send({ nombre: 'Temp', email: tempEmail, password: 'pass123', rolId: userRoleId });
        expect(create.status).toBe(201);
        const purge = await (0, supertest_1.default)(app_1.app)
            .post('/api/usuarios/purge')
            .set('Authorization', `Bearer ${sysadminToken}`)
            .send({});
        expect(purge.status).toBe(200);
        expect(purge.body.deleted).toBeGreaterThanOrEqual(1);
        // Verificar que el sysadmin aún existe (puede acceder a /api/roles)
        const rolesRes = await (0, supertest_1.default)(app_1.app)
            .get('/api/roles')
            .set('Authorization', `Bearer ${sysadminToken}`);
        expect(rolesRes.status).toBe(200);
    });
});
