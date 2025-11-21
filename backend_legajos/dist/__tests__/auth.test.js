"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../src/app");
const prisma_1 = require("../src/prisma");
const TEST_EMAIL = 'test@example.com';
describe('Auth flow', () => {
    let adminRoleId;
    beforeAll(async () => {
        const adminRole = await prisma_1.prisma.rol.upsert({
            where: { nombre: 'admin' },
            update: {},
            create: { nombre: 'admin' }
        });
        adminRoleId = adminRole.id;
    });
    afterAll(async () => {
        await prisma_1.prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
    });
    it('signup and login', async () => {
        const signup = await (0, supertest_1.default)(app_1.app).post('/api/auth/signup').send({
            nombre: 'Tester',
            email: TEST_EMAIL,
            password: 'supersecret',
            rolId: adminRoleId
        });
        expect(signup.status).toBe(201);
        expect(signup.body.token).toBeDefined();
        const login = await (0, supertest_1.default)(app_1.app).post('/api/auth/login').send({
            email: TEST_EMAIL,
            password: 'supersecret'
        });
        expect(login.status).toBe(200);
        expect(login.body.token).toBeDefined();
    });
});
