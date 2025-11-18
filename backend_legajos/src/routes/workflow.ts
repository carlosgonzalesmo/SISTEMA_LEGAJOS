import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { prisma } from '../prisma';
import { z } from 'zod';

const router = Router();
const io: any = (global as any).io;

// Schemas
const createSolicitudSchema = z.object({
  legajoIds: z.array(z.number().int()).min(1)
});

const prepareSolicitudSchema = z.object({
  foundLegajoIds: z.array(z.number().int()).default([]),
  blockedLegajoIds: z.array(z.number().int()).default([]),
  notes: z.string().optional()
});

const devolucionInitSchema = z.object({
  legajoIds: z.array(z.number().int()).min(1)
});

const devolucionConfirmSchema = z.object({
  legajoIds: z.array(z.number().int()).min(1)
});

// Utils
async function isAdmin(userId: number) {
  const u = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!u) return false;
  const rol = await prisma.rol.findUnique({ where: { id: u.rolId } });
  return rol?.nombre?.toLowerCase() === 'admin';
}

async function isSysadmin(userId: number) {
  const u = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!u) return false;
  const rol = await prisma.rol.findUnique({ where: { id: u.rolId } });
  return rol?.nombre?.toLowerCase() === 'sysadmin';
}

// Create a new multi-file solicitud
router.post('/solicitudes', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    if (await isSysadmin(req.userId)) return res.status(403).json({ error: 'No autorizado' });
    const { legajoIds } = createSolicitudSchema.parse(req.body);
    // Use transaction to avoid race conditions when multiple users request same legajo
    const solicitudId = await prisma.$transaction(async (tx) => {
      const legajos = await tx.legajo.findMany({ where: { id: { in: legajoIds } } });
      if (legajos.length !== legajoIds.length) throw new Error('Algunos legajos no existen');
      // Validate availability: allow 'available' or legacy 'activo'
      const notAvailable = legajos.filter(l => !['available', 'activo'].includes(l.estado));
      if (notAvailable.length > 0) throw new Error('Uno o más legajos no están disponibles');
      const solicitud = await (tx as any).solicitud.create({ data: { usuarioId: req.userId, approvedFileIds: [], blockedFileIds: [] } });
      await (tx as any).solicitudLegajo.createMany({ data: legajoIds.map(id => ({ solicitudId: solicitud.id, legajoId: id })) });
      // Mark legajos as requested immediately to prevent duplicate solicitudes
      await tx.legajo.updateMany({ where: { id: { in: legajoIds } }, data: { estado: 'requested' } });
      return solicitud.id;
    });
    const full = await (prisma as any).solicitud.findUnique({ where: { id: solicitudId }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.status(201).json(full);
    try { io?.emit('solicitud:created', full); console.log('[socket] solicitud:created', full.id); } catch {}
  } catch (e: any) {
    if (e.message === 'Algunos legajos no existen') return res.status(400).json({ error: e.message });
    if (e.message === 'Uno o más legajos no están disponibles') return res.status(409).json({ error: e.message });
    next(e);
  }
});

// List solicitudes (admin sees all; user sees own)
router.get('/solicitudes', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    if (await isSysadmin(req.userId)) return res.status(403).json({ error: 'No autorizado' });
    const admin = await isAdmin(req.userId);
    const where = admin ? {} : { usuarioId: req.userId };
    const data = await (prisma as any).solicitud.findMany({ where, orderBy: { id: 'desc' }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.json(data);
  } catch (e) { next(e); }
});

// Prepare (approve or block some legajos) - ADMIN
router.post('/solicitudes/:id/prepare', authMiddleware, requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const { foundLegajoIds, blockedLegajoIds, notes } = prepareSolicitudSchema.parse(req.body);
    const solicitud = await (prisma as any).solicitud.findUnique({ where: { id }, include: { legajos: true } });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const allIds = solicitud.legajos.map((sl: any) => sl.legajoId);
    if (![...foundLegajoIds, ...blockedLegajoIds].every(lid => allIds.includes(lid))) {
      return res.status(400).json({ error: 'IDs no pertenecen a la solicitud' });
    }
    if (foundLegajoIds.length) {
      await prisma.legajo.updateMany({ where: { id: { in: foundLegajoIds } }, data: { estado: 'requested' } });
    }
    if (blockedLegajoIds.length) {
      await prisma.legajo.updateMany({ where: { id: { in: blockedLegajoIds } }, data: { estado: 'blocked' } });
    }
    const updated = await (prisma as any).solicitud.update({ where: { id }, data: { status: foundLegajoIds.length > 0 ? 'APPROVED' : 'REJECTED', approvedAt: foundLegajoIds.length > 0 ? new Date() : undefined, rejectedAt: foundLegajoIds.length === 0 ? new Date() : undefined, notes, approvedFileIds: foundLegajoIds, blockedFileIds: blockedLegajoIds } });
    const full = await (prisma as any).solicitud.findUnique({ where: { id: updated.id }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.json(full);
    try { io?.emit('solicitud:updated', full); console.log('[socket] solicitud:updated', full.id); } catch {}
  } catch (e) { next(e); }
});

// Confirm receipt (user) -> legajos become on-loan
router.post('/solicitudes/:id/confirm-receipt', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    if (await isSysadmin(req.userId)) return res.status(403).json({ error: 'No autorizado' });
    const id = Number(req.params.id);
    const solicitud = await (prisma as any).solicitud.findUnique({ where: { id }, include: { legajos: true } });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.usuarioId !== req.userId) return res.status(403).json({ error: 'No autorizado' });
    if (solicitud.status !== 'APPROVED') return res.status(400).json({ error: 'Solicitud no aprobada' });
    // Only process approvedFileIds, not blocked ones.
    const approvedIds: number[] = (solicitud.approvedFileIds || []);
    if (approvedIds.length === 0) return res.status(400).json({ error: 'No hay legajos aprobados para confirmar recepción' });
    await prisma.legajo.updateMany({ where: { id: { in: approvedIds } }, data: { estado: 'on-loan', currentHolderId: req.userId } });
    // History entries
    if (approvedIds.length) {
      await prisma.legajoHolderHistory.createMany({ data: approvedIds.map(id => ({ legajoId: id, usuarioId: req.userId as number })) });
    }
    const updated = await (prisma as any).solicitud.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    res.json(updated);
    try { io?.emit('solicitud:updated', updated); console.log('[socket] solicitud:updated', updated.id); } catch {}
  } catch (e) { next(e); }
});

// Iniciar devolución (user) - mark legajos pending-return
router.post('/devoluciones', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    if (await isSysadmin(req.userId)) return res.status(403).json({ error: 'No autorizado' });
    const { legajoIds } = devolucionInitSchema.parse(req.body);
  const legajos = await (prisma as any).legajo.findMany({ where: { id: { in: legajoIds }, estado: 'on-loan', currentHolderId: req.userId } });
    if (legajos.length !== legajoIds.length) return res.status(400).json({ error: 'Algunos legajos no están en préstamo por el usuario actual' });
    await prisma.legajo.updateMany({ where: { id: { in: legajoIds } }, data: { estado: 'pending-return' } });
    const devolucion = await (prisma as any).devolucion.create({ data: { usuarioId: req.userId } });
    await (prisma as any).devolucionLegajo.createMany({ data: legajoIds.map(id => ({ devolucionId: devolucion.id, legajoId: id })) });
    const full = await (prisma as any).devolucion.findUnique({ where: { id: devolucion.id }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.status(201).json(full);
    try { io?.emit('devolucion:created', full); console.log('[socket] devolucion:created', full.id); } catch {}
  } catch (e) { next(e); }
});

// Confirm devolución (admin) -> legajos available
router.get('/devoluciones', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    if (await isSysadmin(req.userId)) return res.status(403).json({ error: 'No autorizado' });
    const admin = await isAdmin(req.userId);
    const where = admin ? {} : { usuarioId: req.userId };
    const data = await (prisma as any).devolucion.findMany({ where, orderBy: { id: 'desc' }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.json(data);
  } catch (e) { next(e); }
});

router.post('/devoluciones/:id/confirm', authMiddleware, requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const devolucion = await (prisma as any).devolucion.findUnique({ where: { id }, include: { legajos: true } });
    if (!devolucion) return res.status(404).json({ error: 'Devolución no encontrada' });
    if (devolucion.status !== 'PENDING_RETURN') return res.status(400).json({ error: 'No está pendiente' });
    const legajoIds = devolucion.legajos.map((dl: any) => dl.legajoId);
  await prisma.legajo.updateMany({ where: { id: { in: legajoIds } }, data: { estado: 'available', currentHolderId: null } });
  // Close history entries
  await prisma.legajoHolderHistory.updateMany({ where: { legajoId: { in: legajoIds }, endedAt: null }, data: { endedAt: new Date() } });
    const updated = await (prisma as any).devolucion.update({ where: { id }, data: { status: 'RETURNED', completedAt: new Date() } });
    res.json(updated);
    try { io?.emit('devolucion:updated', updated); console.log('[socket] devolucion:updated', updated.id); } catch {}
  } catch (e) { next(e); }
});

// Clear all workflow transactions (ADMIN)
router.post('/clear', authMiddleware, requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const deletedSolicitudLegajos = await (tx as any).solicitudLegajo.deleteMany({});
      const deletedDevolucionLegajos = await (tx as any).devolucionLegajo.deleteMany({});
  const deletedPrestamos = await (tx as any).prestamo.deleteMany({});
      const deletedSolicitudes = await (tx as any).solicitud.deleteMany({});
      const deletedDevoluciones = await (tx as any).devolucion.deleteMany({});
    const resetLegajos = await (tx as any).legajo.updateMany({ where: { OR: [ { estado: 'requested' }, { estado: 'blocked' }, { estado: 'on-loan' }, { estado: 'pending-return' } ] }, data: { estado: 'available', currentHolderId: null } });
    // Close all open holder history records
    const closedHistory = await (tx as any).legajoHolderHistory.updateMany({ where: { endedAt: null }, data: { endedAt: new Date() } });
      return { deletedSolicitudLegajos, deletedDevolucionLegajos, deletedPrestamos, deletedSolicitudes, deletedDevoluciones, resetLegajos, closedHistory };
    });
    res.json({ ok: true, ...result });
    try { io?.emit('workflow:cleared', { ok: true }); console.log('[socket] workflow:cleared'); } catch {}
  } catch (e) { next(e); }
});

export default router;