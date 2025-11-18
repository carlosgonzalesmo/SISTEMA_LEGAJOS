import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { signToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const signupSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rolId: z.number().int().optional()
});

router.post('/signup', async (req, res, next) => {
  try {
    const parsed = signupSchema.parse(req.body);
    const exists = await prisma.usuario.findUnique({ where: { email: parsed.email } });
    if (exists) return res.status(409).json({ error: 'Email ya registrado' });
    let finalRoleId = parsed.rolId;
    if (!finalRoleId) {
      const userRole = await prisma.rol.findUnique({ where: { nombre: 'user' } });
      if (!userRole) {
        // crear rol user si falta
        const createdUserRole = await prisma.rol.create({ data: { nombre: 'user' } });
        finalRoleId = createdUserRole.id;
      } else {
        finalRoleId = userRole.id;
      }
    } else {
      const role = await prisma.rol.findUnique({ where: { id: finalRoleId } });
      if (!role) {
        // Fallback silencioso a rol 'user'
        const userRole = await prisma.rol.findUnique({ where: { nombre: 'user' } }) || await prisma.rol.create({ data: { nombre: 'user' } });
        finalRoleId = userRole.id;
      }
    }
    const hash = await bcrypt.hash(parsed.password, 10);
    const user = await prisma.usuario.create({ data: { nombre: parsed.nombre, email: parsed.email, password: hash, rolId: finalRoleId }, include: { rol: true } });
    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId, roleName: user.rol?.nombre }, assignedDefaultRole: !parsed.rolId || parsed.rolId !== user.rolId });
  } catch (e) { next(e); }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId, roleName: user.rol?.nombre } });
  } catch (e) { next(e); }
});

export default router;
