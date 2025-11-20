import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';

// Utility to get auth token
async function getAdminToken() {
  const adminRole = await prisma.rol.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: { nombre: 'admin' }
  });
  const email = 'legajotest_admin@example.com';
  await prisma.usuario.deleteMany({ where: { email } });
  const signup = await request(app).post('/api/auth/signup').send({
    nombre: 'Legajo Tester',
    email,
    password: 'supersecret',
    rolId: adminRole.id
  });
  return signup.body.token as string;
}

function uniqueCode(prefix: string) {
  // ensure 0-9999 to produce 4-digit padded
  const n = Math.floor(Math.random()*10000);
  return `${prefix}-${n}`;
}

describe('Legajos DNI/CE validation', () => {
  let token: string;
  beforeAll(async () => { token = await getAdminToken(); });

  it('creates legajo without dniCe', async () => {
    const res = await request(app)
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
    const res = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test B', descripcion: 'invalid dni', estado: 'available', dniCe: '1234' });
    expect(res.status).toBe(400);
  });

  it('accepts valid 8-digit DNI', async () => {
    const res = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test C', descripcion: 'dni', estado: 'available', dniCe: '12345678' });
    expect(res.status).toBe(201);
    expect(res.body.dniCe).toBe('12345678');
  });

  it('accepts valid 12-digit CE', async () => {
    const res = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test D', descripcion: 'ce', estado: 'available', dniCe: '123456789012' });
    expect(res.status).toBe(201);
    expect(res.body.dniCe).toBe('123456789012');
  });

  it('rejects duplicate dniCe on create', async () => {
    const one = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'Dup DNI 1', descripcion: 'dup1', estado: 'available', dniCe: '99999999' });
    expect(one.status).toBe(201);
    const dup = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'Dup DNI 2', descripcion: 'dup2', estado: 'available', dniCe: '99999999' });
    expect(dup.status).toBe(409);
  });

  it('rejects duplicate dniCe on update', async () => {
    const first = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'Upd DNI 1', descripcion: 'upd1', estado: 'available', dniCe: '88888888' });
    expect(first.status).toBe(201);
    const second = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'Upd DNI 2', descripcion: 'upd2', estado: 'available' });
    expect(second.status).toBe(201);
    const upd = await request(app)
      .put(`/api/legajos/${second.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dniCe: '88888888' });
    expect(upd.status).toBe(409);
  });

  it('updates legajo with valid dniCe', async () => {
    const create = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test E', descripcion: 'update add', estado: 'available' });
    expect(create.status).toBe(201);
    const update = await request(app)
      .put(`/api/legajos/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dniCe: '87654321' });
    expect(update.status).toBe(200);
    expect(update.body.dniCe).toBe('87654321');
  });

  it('rejects update with invalid dniCe', async () => {
    const create = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test F', descripcion: 'update invalid', estado: 'available' });
    expect(create.status).toBe(201);
    const update = await request(app)
      .put(`/api/legajos/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dniCe: 'abc' });
    expect(update.status).toBe(400);
  });

  it('clears dniCe when empty string provided', async () => {
    const initialDni = Math.floor(10000000 + Math.random()*90000000).toString(); // random 8-digit
    const create = await request(app)
      .post('/api/legajos')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: uniqueCode('L'), titulo: 'DNI/CE Test G', descripcion: 'clear', estado: 'available', dniCe: initialDni });
    expect(create.status).toBe(201);
    const update = await request(app)
      .put(`/api/legajos/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dniCe: '' });
    expect(update.status).toBe(200);
    expect(update.body.dniCe).toBeNull();
  });
});
