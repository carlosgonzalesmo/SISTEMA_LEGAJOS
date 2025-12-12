import { Router } from 'express';
import { UsuariosService } from '../services/usuarios.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireRole, requireAnyRole } from '../middleware/roles';
import { z } from 'zod';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';

const router = Router();

router.get('/', authMiddleware, requireRole('sysadmin'), async (_req, res, next) => {
  try {
    const data = await (UsuariosService as any).list({ include: { rol: true } });
    res.json(data.map((u: any) => ({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId, roleName: u.rol?.nombre, activo: (u as any).activo })));
  } catch (e) { next(e); }
});

// Nuevo endpoint: obtener el usuario autenticado a partir del token
router.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const u = await (UsuariosService as any).get(req.userId, { include: { rol: true } });
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!(u as any).activo) return res.status(403).json({ error: 'Usuario deshabilitado' });
    res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId, roleName: u.rol?.nombre, activo: (u as any).activo });
  } catch (e) { next(e); }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const u = await (UsuariosService as any).get(Number(req.params.id), { include: { rol: true } });
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId, roleName: u.rol?.nombre, activo: (u as any).activo });
  } catch (e) { next(e); }
});

const createUserSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rolId: z.number().int()
});

const updateUserSchema = z.object({
  nombre: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  rolId: z.number().int().optional()
});

router.post('/', authMiddleware, requireRole('sysadmin'), async (req, res, next) => {
  try {
    const parsed = createUserSchema.parse(req.body);
    const exists = await UsuariosService.getByEmail?.(parsed.email);
    if (exists) return res.status(409).json({ error: 'Email ya existe' });
    const hash = await bcrypt.hash(parsed.password, 10);
    const user = await (UsuariosService as any).create({ ...parsed, password: hash }, { include: { rol: true } });
    const payload = { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId, roleName: user.rol?.nombre, activo: true };
    res.status(201).json(payload);
    try { (global as any).io?.emit('user:created', payload); } catch {}
  } catch (e) { next(e); }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const id = Number(req.params.id);
    // Obtener usuario solicitante para verificar permisos
    const requester = await UsuariosService.get(req.userId);
    if (!requester) return res.status(401).json({ error: 'No autenticado' });
    const isSysadmin = requester.rol?.nombre === 'sysadmin';
    // Solo sysadmin puede modificar a otros usuarios; los demás solo a sí mismos
    if (!isSysadmin && req.userId !== id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    // Validar payload
    const parsed = updateUserSchema.parse(req.body);
    const updateData: any = { ...parsed };
    // Solo sysadmin puede cambiar rolId
    if (!isSysadmin && 'rolId' in updateData) {
      delete updateData.rolId;
    }
    // Regla: no permitir quitar el último admin activo mediante cambio de rol (aplica cuando sysadmin intenta cambiarlo)
    if (isSysadmin && updateData.rolId) {
      const target = await UsuariosService.get(id);
      if (target && target.rol?.nombre === 'admin' && updateData.rolId !== target.rolId) {
        const all = await UsuariosService.list();
        const remainingActiveAdmins = all.filter((u: any) => u.rolId === target.rolId && (u as any).activo !== false && u.id !== id).length;
        if (remainingActiveAdmins === 0) {
          return res.status(400).json({ error: 'No puedes quitar el último administrador activo' });
        }
      }
    }
    // Hash de contraseña si viene nueva
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    // Evitar colisión de email
    if (updateData.email) {
      const existing = await UsuariosService.getByEmail(updateData.email);
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'Email ya existe' });
      }
    }
    const user = await (UsuariosService as any).update(id, updateData, { include: { rol: true } });
    const payload = { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId, roleName: user.rol?.nombre, activo: (user as any).activo };
    res.json(payload);
    try { (global as any).io?.emit('user:updated', payload); } catch {}
  } catch (e) { next(e); }
});

router.delete('/:id', authMiddleware, requireRole('sysadmin'), async (req, res, next) => {
  try { await UsuariosService.delete(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); }
});

// Deshabilitar usuario (soft delete) - solo admin y no puede deshabilitarse a sí mismo
router.post('/:id/disable', authMiddleware, requireRole('sysadmin'), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (req.userId === id) return res.status(400).json({ error: 'No puedes deshabilitar tu propio usuario' });
    const updated = await (UsuariosService as any).update(id, { activo: false } as any, { include: { rol: true } });
    const payload = { id: updated.id, nombre: updated.nombre, email: updated.email, rolId: updated.rolId, roleName: updated.rol?.nombre, activo: (updated as any).activo };
    res.json(payload);
    try { (global as any).io?.emit('user:updated', payload); } catch {}
  } catch (e) { next(e); }
});

// Habilitar usuario - solo admin
router.post('/:id/enable', authMiddleware, requireRole('sysadmin'), async (_req, res, next) => {
  try {
    const id = Number(_req.params.id);
    const updated = await (UsuariosService as any).update(id, { activo: true } as any, { include: { rol: true } });
    const payload = { id: updated.id, nombre: updated.nombre, email: updated.email, rolId: updated.rolId, roleName: updated.rol?.nombre, activo: (updated as any).activo };
    res.json(payload);
    try { (global as any).io?.emit('user:updated', payload); } catch {}
  } catch (e) { next(e); }
});

export default router;

// Purge masivo de usuarios (excepto el propio sysadmin por defecto)
// Advertencia: Esta operación es destructiva. Se puede pasar { includeSelf: true } para eliminar también
// al usuario autenticado, lo cual dejaría el sistema sin usuarios hasta re-seed.
router.post('/purge', authMiddleware, requireRole('sysadmin'), async (req: AuthRequest, res, next) => {
  try {
    const includeSelf = !!req.body?.includeSelf;
    const targetUsers = await prisma.usuario.findMany({ where: includeSelf ? {} : { NOT: { id: req.userId } } });
    if (targetUsers.length === 0) return res.json({ deleted: 0, includeSelf });
    const ids = targetUsers.map((u: any) => u.id);
    await prisma.$transaction([
      // Eliminar workflow relacionado primero (solicitudes, devoluciones, prestamos) y sus tablas puente
      prisma.solicitudLegajo.deleteMany({ where: { solicitud: { usuarioId: { in: ids } } } }),
      prisma.devolucionLegajo.deleteMany({ where: { devolucion: { usuarioId: { in: ids } } } }),
      prisma.prestamo.deleteMany({ where: { usuarioId: { in: ids } } }),
      prisma.solicitud.deleteMany({ where: { usuarioId: { in: ids } } }),
      prisma.devolucion.deleteMany({ where: { usuarioId: { in: ids } } }),
         // Historial de titulares asociado a legajos de los usuarios O donde el usuario figura como titular histórico
         prisma.legajoHolderHistory.deleteMany({ where: { OR: [ { usuarioId: { in: ids } }, { legajo: { usuarioId: { in: ids } } } ] } }),
         // Archivos asociados a legajos de los usuarios a eliminar
      prisma.archivo.deleteMany({ where: { legajo: { usuarioId: { in: ids } } } }),
      // Legajos de los usuarios
      prisma.legajo.deleteMany({ where: { usuarioId: { in: ids } } }),
      // Finalmente los usuarios
      prisma.usuario.deleteMany({ where: { id: { in: ids } } })
    ]);
    res.json({ deleted: ids.length, includeSelf });
  } catch (e) { next(e); }
});
