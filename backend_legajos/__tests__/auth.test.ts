import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_EMAIL = 'test@example.com';

describe('Auth flow', () => {
  let adminRoleId: number;
  beforeAll(async () => {
    const adminRole = await prisma.rol.upsert({
      where: { nombre: 'admin' },
      update: {},
      create: { nombre: 'admin' }
    });
    adminRoleId = adminRole.id;
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('signup and login', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      nombre: 'Tester',
      email: TEST_EMAIL,
      password: 'supersecret',
      rolId: adminRoleId
    });
    expect(signup.status).toBe(201);
    expect(signup.body.token).toBeDefined();

    const login = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: 'supersecret'
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });
});