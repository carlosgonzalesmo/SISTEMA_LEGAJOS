import { Router } from 'express';
import { UsuariosService } from '../services/usuarios.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { z } from 'zod';

const router = Router();

router.get('/', authMiddleware, async (_req, res, next) => {
  try {
    const data = await UsuariosService.list();
    res.json(data.map((u: any) => ({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId })));
  } catch (e) { next(e); }
});

// Nuevo endpoint: obtener el usuario autenticado a partir del token
router.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const u = await UsuariosService.get(req.userId);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId });
  } catch (e) { next(e); }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const u = await UsuariosService.get(Number(req.params.id));
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId });
  } catch (e) { next(e); }
});

const createUserSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rolId: z.number().int()
});

router.post('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const parsed = createUserSchema.parse(req.body);
    const exists = await UsuariosService.getByEmail?.(parsed.email);
    if (exists) return res.status(409).json({ error: 'Email ya existe' });
    const user = await UsuariosService.create(parsed);
    res.status(201).json({ id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId });
  } catch (e) { next(e); }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await UsuariosService.update(id, req.body);
    res.json({ id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId });
  } catch (e) { next(e); }
});

router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try { await UsuariosService.delete(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); }
});

export default router;
