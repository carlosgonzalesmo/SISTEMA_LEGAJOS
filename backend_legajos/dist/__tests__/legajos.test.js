"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../src/app");
const prisma_1 = require("../src/prisma");
// Utility to get auth token
async function getAdminToken() {
    const adminRole = await prisma_1.prisma.rol.upsert({
        where: { nombre: 'admin' },
        update: {},
        create: { nombre: 'admin' }
    });
    const email = 'legajotest_admin@example.com';
    // Cascading cleanup in case previous test run left data.
    const existing = await prisma_1.prisma.usuario.findUnique({ where: { email } });
    if (existing) {
        await prisma_1.prisma.legajo.deleteMany({ where: { usuarioId: existing.id } });
        await prisma_1.prisma.usuario.deleteMany({ where: { email } });
    }
    const signup = await (0, supertest_1.default)(app_1.app).post('/api/auth/signup').send({
        nombre: 'Legajo Tester',
        email,
        password: 'supersecret',
        rolId: adminRole.id
    });
    return signup.body.token;
}
function uniqueCode(prefix) {
    // ensure 0-9999 to produce 4-digit padded
    const n = Math.floor(Math.random() * 10000);
    return `${prefix}-${n}`;
}
describe('Legajos DNI/CE validation', () => {
    let token;
    beforeAll(async () => { token = await getAdminToken(); });
    it('creates legajo without dniCe', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test A', descripcion: 'no dni', estado: 'available' });
        if (res.status !== 201) {
            // eslint-disable-next-line no-console
            console.log('Create without dniCe error body:', res.body);
        }
        expect(res.status).toBe(201);
        expect(res.body.dniCe).toBeNull();
    });
    it('rejects invalid dniCe length', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test B', descripcion: 'invalid dni', estado: 'available', dniCe: '1234' });
        expect(res.status).toBe(400);
    });
    it('accepts valid 8-digit DNI', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test C', descripcion: 'dni', estado: 'available', dniCe: '12345678' });
        expect(res.status).toBe(201);
        expect(res.body.dniCe).toBe('12345678');
    });
    it('accepts valid 12-digit CE', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test D', descripcion: 'ce', estado: 'available', dniCe: '123456789012' });
        expect(res.status).toBe(201);
        expect(res.body.dniCe).toBe('123456789012');
    });
    it('rejects duplicate dniCe on create', async () => {
        const one = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'Dup DNI 1', descripcion: 'dup1', estado: 'available', dniCe: '99999999' });
        expect(one.status).toBe(201);
        const dup = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'Dup DNI 2', descripcion: 'dup2', estado: 'available', dniCe: '99999999' });
        expect(dup.status).toBe(409);
    });
    it('rejects duplicate dniCe on update', async () => {
        const first = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'Upd DNI 1', descripcion: 'upd1', estado: 'available', dniCe: '88888888' });
        expect(first.status).toBe(201);
        const second = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'Upd DNI 2', descripcion: 'upd2', estado: 'available' });
        expect(second.status).toBe(201);
        const upd = await (0, supertest_1.default)(app_1.app)
            .put(`/api/legajos/${second.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ dniCe: '88888888' });
        expect(upd.status).toBe(409);
    });
    it('updates legajo with valid dniCe', async () => {
        const create = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test E', descripcion: 'update add', estado: 'available' });
        expect(create.status).toBe(201);
        const update = await (0, supertest_1.default)(app_1.app)
            .put(`/api/legajos/${create.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ dniCe: '87654321' });
        expect(update.status).toBe(200);
        expect(update.body.dniCe).toBe('87654321');
    });
    it('rejects update with invalid dniCe', async () => {
        const create = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test F', descripcion: 'update invalid', estado: 'available' });
        expect(create.status).toBe(201);
        const update = await (0, supertest_1.default)(app_1.app)
            .put(`/api/legajos/${create.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ dniCe: 'abc' });
        expect(update.status).toBe(400);
    });
    it('clears dniCe when empty string provided', async () => {
        const initialDni = Math.floor(10000000 + Math.random() * 90000000).toString(); // random 8-digit
        const create = await (0, supertest_1.default)(app_1.app)
            .post('/api/legajos')
            .set('Authorization', `Bearer ${token}`)
            .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test G', descripcion: 'clear', estado: 'available', dniCe: initialDni });
        expect(create.status).toBe(201);
        const update = await (0, supertest_1.default)(app_1.app)
            .put(`/api/legajos/${create.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ dniCe: '' });
        expect(update.status).toBe(200);
        expect(update.body.dniCe).toBeNull();
    });
});
