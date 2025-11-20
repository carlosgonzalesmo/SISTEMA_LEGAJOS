import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { app } from '../src/app';
import { prisma } from '../src/prisma';

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

describe('Legajo unlock flow', () => {
  const TEST_EMAIL = 'unlock_admin@example.com';
  let adminRoleId: number;
  let token: string;
  let legajoId: number;

  beforeAll(async () => {
    const adminRole = await prisma.rol.upsert({
      where: { nombre: 'admin' },
      update: {},
      create: { nombre: 'admin' }
    });
    adminRoleId = adminRole.id;

    // Sign up admin
    const signup = await request(app).post('/api/auth/signup').send({
      nombre: 'Unlock Admin',
      email: TEST_EMAIL,
      password: 'supersecret',
      rolId: adminRoleId
    });
    expect(signup.status).toBe(201);
    token = signup.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup created data
    if (legajoId) {
      await prisma.legajoRecoveryHistory.deleteMany({ where: { legajoId } });
      await prisma.legajoHolderHistory.deleteMany({ where: { legajoId } });
      await prisma.legajo.deleteMany({ where: { id: legajoId } });
    }
    await prisma.usuario.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('creates blocked legajo', async () => {
    const res = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'L-5', titulo: 'Blocked Test', descripcion: 'Testing unlock', estado: 'blocked' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.estado).toBe('blocked');
    legajoId = res.body.id;
  });

  it('fails unlock with short reason', async () => {
    const res = await request(app)
      .post(`/api/legajos/${legajoId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'x' }); // too short (min 2)
    expect(res.status).toBe(400); // Zod validation
  });

  it('unlocks legajo with valid reason', async () => {
    const res = await request(app)
      .post(`/api/legajos/${legajoId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Recovered after audit' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('available');
  });

  it('creates recovery history entry', async () => {
    const res = await request(app)
      .get(`/api/legajos/${legajoId}/recoveries`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].reason).toBe('Recovered after audit');
  });

  it('second unlock attempt fails with 409', async () => {
    const res = await request(app)
      .post(`/api/legajos/${legajoId}/unlock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Another reason' });
    expect(res.status).toBe(409);
  });
});
