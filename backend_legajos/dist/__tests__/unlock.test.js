"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
const app_1 = require("../src/app");
const prisma_1 = require("../src/prisma");
/**
 * Tests for unlock (recovery) feature.
 * Flow:
 *  - Ensure admin role exists
 *  - Sign up admin user & obtain token
 *  - Create blocked legajo
 *  - Unlock legajo with reason
 *  - Verify estado changed to available
 *  - Verify recovery history contains entry
 *  - Attempt second unlock (should 409)
 */
(0, globals_1.describe)('Legajo unlock flow', () => {
    const TEST_EMAIL = 'unlock_admin@example.com';
    let adminRoleId;
    let token;
    let legajoId;
    (0, globals_1.beforeAll)(async () => {
        const adminRole = await prisma_1.prisma.rol.upsert({
            where: { nombre: 'admin' },
            update: {},
            create: { nombre: 'admin' }
        });
        adminRoleId = adminRole.id;
        // Sign up admin
        const signup = await (0, supertest_1.default)(app_1.app).post('/api/auth/signup').send({
            nombre: 'Unlock Admin',
            email: TEST_EMAIL,
            password: 'supersecret',
            rolId: adminRoleId
        });
        (0, globals_1.expect)(signup.status).toBe(201);
        token = signup.body.token;
        (0, globals_1.expect)(token).toBeDefined();
    });
    (0, globals_1.afterAll)(async () => {
        // Cleanup created data
        if (legajoId) {
            await prisma_1.prisma.legajoRecoveryHistory.deleteMany({ where: { legajoId } });
            await prisma_1.prisma.legajoHolderHistory.deleteMany({ where: { legajoId } });
            await prisma_1.prisma.legajo.deleteMany({ where: { id: legajoId } });
        }
        await prisma_1.prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
    });
    (0, globals_1.it)('creates blocked legajo', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: 'L-5', titulo: 'Blocked Test', descripcion: 'Testing unlock', estado: 'blocked' });
        (0, globals_1.expect)(res.status).toBe(201);
        (0, globals_1.expect)(res.body.id).toBeDefined();
        (0, globals_1.expect)(res.body.estado).toBe('blocked');
        legajoId = res.body.id;
    });
    (0, globals_1.it)('fails unlock with short reason', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post(`/api/legajos/${legajoId}/unlock`)
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'x' }); // too short (min 2)
        (0, globals_1.expect)(res.status).toBe(400); // Zod validation
    });
    (0, globals_1.it)('unlocks legajo with valid reason', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post(`/api/legajos/${legajoId}/unlock`)
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'Recovered after audit' });
        (0, globals_1.expect)(res.status).toBe(200);
        (0, globals_1.expect)(res.body.estado).toBe('available');
    });
    (0, globals_1.it)('creates recovery history entry', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .get(`/api/legajos/${legajoId}/recoveries`)
            .set('Authorization', `Bearer ${token}`);
        (0, globals_1.expect)(res.status).toBe(200);
        (0, globals_1.expect)(Array.isArray(res.body)).toBe(true);
        (0, globals_1.expect)(res.body.length).toBe(1);
        (0, globals_1.expect)(res.body[0].reason).toBe('Recovered after audit');
    });
    (0, globals_1.it)('second unlock attempt fails with 409', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post(`/api/legajos/${legajoId}/unlock`)
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'Another reason' });
        (0, globals_1.expect)(res.status).toBe(409);
    });
});
