import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_EMAIL = 'test@example.com';

describe('Auth flow', () => {
  beforeAll(async () => {
    // Ensure role exists
    const adminRole = await prisma.rol.upsert({
      where: { nombre: 'admin' },
      update: {},
      create: { nombre: 'admin' }
    });
  });

  afterAll(async () => {
    await prisma.archivo.deleteMany();
    await prisma.legajo.deleteMany();
    await prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  });

  it('signup and login', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      nombre: 'Tester',
      email: TEST_EMAIL,
      password: 'supersecret',
      rolId: 1
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