import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../prisma';
import { z } from 'zod';

const router = Router();

// Only sysadmin can manage settings; admins/users can read
async function isSysadmin(userId: number) {
  const u = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!u) return false;
  const rol = await prisma.rol.findUnique({ where: { id: u.rolId } });
  return rol?.nombre?.toLowerCase() === 'sysadmin';
}

// Read single setting
router.get('/:key', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const key = String(req.params.key);
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return res.status(404).json({ error: 'Setting no encontrado' });
    res.json(setting);
  } catch (e) { next(e); }
});

// Upsert setting (sysadmin only)
const upsertSchema = z.object({
  value: z.string()
});

router.put('/:key', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    if (!(await isSysadmin(req.userId))) return res.status(403).json({ error: 'No autorizado' });
    const key = String(req.params.key);
    const { value } = upsertSchema.parse(req.body);
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    res.json(setting);
  } catch (e) { next(e); }
});

export default router;
