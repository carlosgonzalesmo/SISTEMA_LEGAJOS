import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { prisma } from '../prisma';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { debug, error as logError } from '../lib/logger';

const router = Router();

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
    // Validación anticipada de límite de préstamos: cantidad actual en préstamo + solicitados
    try {
      const setting = await (prisma as any).systemSetting.findUnique({ where: { key: 'max_loans_per_user' } });
      if (setting) {
        const maxLoans = Number(setting.value);
        if (!Number.isNaN(maxLoans) && maxLoans > 0) {
          const currentOnLoanCount = await prisma.legajo.count({ where: { estado: { in: ['on-loan','pending-return'] }, currentHolderId: req.userId } });
          const projected = currentOnLoanCount + legajoIds.length;
            if (projected > maxLoans) {
              return res.status(409).json({ error: `Supera el máximo de préstamos permitidos (${maxLoans}). Actualmente tiene ${currentOnLoanCount} en préstamo y está intentando solicitar ${legajoIds.length}.` });
            }
        }
      }
    } catch (policyErr) {
      debug('Policy read error (solicitud create)', policyErr);
    }
    // Use transaction to avoid race conditions when multiple users request same legajo
    let affectedLegajoIds: number[] = [];
    const solicitudId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const legajos = await tx.legajo.findMany({ where: { id: { in: legajoIds } } });
      if (legajos.length !== legajoIds.length) throw new Error('Algunos legajos no existen');
      // Validate availability: allow 'available' or legacy 'activo'
      const notAvailable = legajos.filter((l: any) => !['available', 'activo'].includes(l.estado));
      if (notAvailable.length > 0) throw new Error('Uno o más legajos no están disponibles');
      const solicitud = await (tx as any).solicitud.create({ data: { usuarioId: req.userId, approvedFileIds: [], blockedFileIds: [] } });
      await (tx as any).solicitudLegajo.createMany({ data: legajoIds.map(id => ({ solicitudId: solicitud.id, legajoId: id })) });
      // Mark legajos as requested immediately to prevent duplicate solicitudes
      await tx.legajo.updateMany({ where: { id: { in: legajoIds } }, data: { estado: 'requested' } });
      affectedLegajoIds = legajoIds.slice();
      return solicitud.id;
    });
    const full = await (prisma as any).solicitud.findUnique({ where: { id: solicitudId }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.status(201).json(full);
    try { (global as any).io?.emit('solicitud:created', full); debug('[socket] solicitud:created', full.id); } catch {}
    // Emitir actualizaciones de cada legajo afectado (estado -> requested)
    try {
      if (affectedLegajoIds.length) {
        const updatedLegajos = await prisma.legajo.findMany({ where: { id: { in: affectedLegajoIds } }, include: { currentHolder: true } });
        for (const lg of updatedLegajos) {
          (global as any).io?.emit('legajo:updated', lg);
          debug('[socket] legajo:updated (requested by solicitud)', lg.id);
        }
      }
    } catch (e) { logError('Emit legajo:updated (solicitud create) error', e); }
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
    const solicitud = await (prisma as any).solicitud.findUnique({ where: { id }, include: { legajos: true, usuario: true } });
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const allIds = solicitud.legajos.map((sl: any) => sl.legajoId);
    if (![...foundLegajoIds, ...blockedLegajoIds].every(lid => allIds.includes(lid))) {
      return res.status(400).json({ error: 'IDs no pertenecen a la solicitud' });
    }
    // Validación de límite antes de aprobar: préstamos actuales (incl. pending-return) del usuario + a aprobar
    try {
      const setting = await (prisma as any).systemSetting.findUnique({ where: { key: 'max_loans_per_user' } });
      if (setting) {
        const maxLoans = Number(setting.value);
        if (!Number.isNaN(maxLoans) && maxLoans > 0) {
          const currentCount = await prisma.legajo.count({ where: { estado: { in: ['on-loan','pending-return'] }, currentHolderId: solicitud.usuarioId } });
          const projected = currentCount + (foundLegajoIds?.length || 0);
          if (projected > maxLoans) {
            return res.status(409).json({ error: `El usuario excederá el máximo permitido (${maxLoans}). Actualmente tiene ${currentCount} y se intenta aprobar ${foundLegajoIds.length}. La solicitud permanece pendiente.` });
          }
        }
      }
    } catch (policyErr) {
      debug('Policy read error (prepare solicitud)', policyErr);
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
    try { (global as any).io?.emit('solicitud:updated', full); debug('[socket] solicitud:updated', full.id); } catch {}
    // Emit legajo updates (requested / blocked)
    try {
      const affected = [...foundLegajoIds, ...blockedLegajoIds];
      if (affected.length) {
        const legajos = await prisma.legajo.findMany({ where: { id: { in: affected } }, include: { currentHolder: true } });
        for (const lg of legajos) {
          (global as any).io?.emit('legajo:updated', lg);
          debug('[socket] legajo:updated (prepare solicitud)', lg.id);
        }
      }
    } catch (e) { logError('Emit legajo:updated (prepare solicitud) error', e); }
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
    // Enforce max loans per user policy, if configured
    try {
      const setting = await (prisma as any).systemSetting.findUnique({ where: { key: 'max_loans_per_user' } });
      if (setting) {
        const maxLoans = Number(setting.value);
        if (!Number.isNaN(maxLoans) && maxLoans > 0) {
          const currentOnLoanCount = await prisma.legajo.count({ where: { estado: { in: ['on-loan','pending-return'] }, currentHolderId: req.userId } });
          const projected = currentOnLoanCount + approvedIds.length;
          if (projected > maxLoans) {
            return res.status(409).json({ error: `Supera el máximo de préstamos permitidos (${maxLoans}). Actualmente tiene ${currentOnLoanCount} en préstamo y está intentando confirmar ${approvedIds.length}.` });
          }
        }
      }
    } catch (policyErr) {
      // Do not block on policy read errors; log and continue
      debug('Policy read error', policyErr);
    }
    await prisma.legajo.updateMany({ where: { id: { in: approvedIds } }, data: { estado: 'on-loan', currentHolderId: req.userId } });
    // History entries
    if (approvedIds.length) {
      await prisma.legajoHolderHistory.createMany({ data: approvedIds.map(id => ({ legajoId: id, usuarioId: req.userId as number })) });
    }
    const updated = await (prisma as any).solicitud.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    // Recuperar objeto completo con legajos y usuario para evitar payload parcial en frontend
    const fullUpdated = await (prisma as any).solicitud.findUnique({ where: { id: updated.id }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.json(fullUpdated);
    try { (global as any).io?.emit('solicitud:updated', fullUpdated); debug('[socket] solicitud:updated', fullUpdated.id); } catch {}
    // Emit legajo updates (on-loan)
    try {
      if (approvedIds.length) {
        const legajos = await prisma.legajo.findMany({ where: { id: { in: approvedIds } }, include: { currentHolder: true } });
        for (const lg of legajos) {
          (global as any).io?.emit('legajo:updated', lg);
          debug('[socket] legajo:updated (confirm receipt)', lg.id);
        }
      }
    } catch (e) { logError('Emit legajo:updated (confirm receipt) error', e); }
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
    try { (global as any).io?.emit('devolucion:created', full); debug('[socket] devolucion:created', full.id); } catch {}
    // Emit legajo updates (pending-return)
    try {
      const legajos = await prisma.legajo.findMany({ where: { id: { in: legajoIds } }, include: { currentHolder: true } });
      for (const lg of legajos) {
        (global as any).io?.emit('legajo:updated', lg);
        debug('[socket] legajo:updated (iniciar devolucion)', lg.id);
      }
    } catch (e) { logError('Emit legajo:updated (iniciar devolucion) error', e); }
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
    const fullUpdated = await (prisma as any).devolucion.findUnique({ where: { id: updated.id }, include: { legajos: { include: { legajo: true } }, usuario: true } });
    res.json(fullUpdated);
    try { (global as any).io?.emit('devolucion:updated', fullUpdated); debug('[socket] devolucion:updated', fullUpdated.id); } catch {}
    // Emit legajo updates (available after return)
    try {
      const legajos = await prisma.legajo.findMany({ where: { id: { in: legajoIds } }, include: { currentHolder: true } });
      for (const lg of legajos) {
        (global as any).io?.emit('legajo:updated', lg);
        debug('[socket] legajo:updated (confirm devolucion)', lg.id);
      }
    } catch (e) { logError('Emit legajo:updated (confirm devolucion) error', e); }
  } catch (e) { next(e); }
});

// Clear all workflow transactions (ADMIN)
// Full destructive purge: deletes all workflow data AND legajos (admin only)
router.post('/clear', authMiddleware, requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete workflow linkage tables first (FK dependencies)
      const deletedSolicitudLegajos = await (tx as any).solicitudLegajo.deleteMany({});
      const deletedDevolucionLegajos = await (tx as any).devolucionLegajo.deleteMany({});
      const deletedPrestamos = await (tx as any).prestamo.deleteMany({});
      // Delete workflow roots
      const deletedSolicitudes = await (tx as any).solicitud.deleteMany({});
      const deletedDevoluciones = await (tx as any).devolucion.deleteMany({});
      // Delete holder & recovery histories and archivos before removing legajos
      const deletedHolderHistory = await (tx as any).legajoHolderHistory.deleteMany({});
      const deletedRecoveryHistory = await (tx as any).legajoRecoveryHistory.deleteMany({});
      const deletedArchivos = await (tx as any).archivo.deleteMany({});
      // Finally delete legajos themselves
      const deletedLegajos = await (tx as any).legajo.deleteMany({});
      return { deletedSolicitudLegajos, deletedDevolucionLegajos, deletedPrestamos, deletedSolicitudes, deletedDevoluciones, deletedHolderHistory, deletedRecoveryHistory, deletedArchivos, deletedLegajos };
    });
    res.json({ ok: true, purged: true, ...result });
    try { (global as any).io?.emit('workflow:cleared', { ok: true, purged: true }); debug('[socket] workflow:cleared (purged)'); } catch {}
  } catch (e) { next(e); }
});

export default router;