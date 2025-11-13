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
  rolId: z.number().int()
});

router.post('/signup', async (req, res, next) => {
  try {
    const parsed = signupSchema.parse(req.body);
    const exists = await prisma.usuario.findUnique({ where: { email: parsed.email } });
    if (exists) return res.status(409).json({ error: 'Email ya registrado' });
    const hash = await bcrypt.hash(parsed.password, 10);
    const user = await prisma.usuario.create({ data: { ...parsed, password: hash } });
    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId } });
  } catch (e) { next(e); }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.usuario.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId } });
  } catch (e) { next(e); }
});

export default router;
