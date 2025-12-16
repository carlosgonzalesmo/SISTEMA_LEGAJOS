"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const legajos_service_1 = require("../services/legajos.service");
// Removed unused createSocketServer import. Socket instance accessed via global.io when available.
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const logger_1 = require("../lib/logger");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const legajo_1 = require("../lib/legajo");
const router = (0, express_1.Router)();
async function denySysadmin(req, res, next) {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        const u = await prisma_1.prisma.usuario.findUnique({ where: { id: req.userId } });
        if (u) {
            const r = await prisma_1.prisma.rol.findUnique({ where: { id: u.rolId } });
            if (r?.nombre?.toLowerCase() === 'sysadmin')
                return res.status(403).json({ error: 'No autorizado' });
        }
        next();
    }
    catch (e) {
        next(e);
    }
}
router.get('/', auth_1.authMiddleware, denySysadmin, async (req, res, next) => {
    try {
        const { estado, usuarioId, search, page = '1', pageSize = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
        const where = {};
        if (estado)
            where.estado = estado;
        if (usuarioId)
            where.usuarioId = Number(usuarioId);
        if (search) {
            where.OR = [
                { codigo: { contains: search, mode: 'insensitive' } },
                { titulo: { contains: search, mode: 'insensitive' } },
                { descripcion: { contains: search, mode: 'insensitive' } },
                { dniCe: { contains: search } }
            ];
        }
        const total = await legajos_service_1.LegajosService.count(where);
        const data = await legajos_service_1.LegajosService.listPaged(where, pageNum, sizeNum);
        res.json({ page: pageNum, pageSize: sizeNum, total, data });
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id', auth_1.authMiddleware, denySysadmin, async (req, res, next) => { try {
    res.json(await legajos_service_1.LegajosService.get(Number(req.params.id)));
}
catch (e) {
    next(e);
} });
// Historial de titulares (solo admin)
router.get('/:id/holder-history', auth_1.authMiddleware, async (req, res, next) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        // Verificar rol admin
        const user = await prisma_1.prisma.usuario.findUnique({ where: { id: req.userId } });
        if (!user)
            return res.status(401).json({ error: 'Usuario inválido' });
        const rol = await prisma_1.prisma.rol.findUnique({ where: { id: user.rolId } });
        if (rol?.nombre?.toLowerCase() !== 'admin')
            return res.status(403).json({ error: 'No autorizado' });
        const legajoId = Number(req.params.id);
        const history = await prisma_1.prisma.legajoHolderHistory.findMany({ where: { legajoId }, orderBy: { startedAt: 'desc' }, include: { usuario: true } });
        res.json(history.map((h) => ({ id: h.id, legajoId: h.legajoId, usuarioId: h.usuarioId, usuarioNombre: h.usuario.nombre, startedAt: h.startedAt, endedAt: h.endedAt })));
    }
    catch (e) {
        next(e);
    }
});
// Lookup por código (normaliza padding)
router.get('/by-codigo/:codigo', auth_1.authMiddleware, denySysadmin, async (req, res, next) => {
    try {
        const raw = String(req.params.codigo);
        const validation = (0, legajo_1.validateCodigo)(raw);
        if (!validation.valid)
            return res.status(400).json({ error: 'Formato inválido' });
        const legajo = await prisma_1.prisma.legajo.findFirst({ where: { codigo: validation.padded }, include: { usuario: true, archivos: true, currentHolder: true } });
        if (!legajo)
            return res.status(404).json({ error: 'No encontrado' });
        res.json(legajo);
    }
    catch (e) {
        next(e);
    }
});
// usuarioId ya no se acepta desde el body para evitar spoof. Se toma del token.
const createLegajoSchema = zod_1.z.object({
    codigo: zod_1.z.string().min(3).refine(v => /^[A-Za-z]-\d+$/.test(v.trim()), 'Formato de código inválido'), // e.g. L-5 or L-0005
    titulo: zod_1.z.string().min(2),
    descripcion: zod_1.z.string().optional(),
    estado: zod_1.z.string().min(2),
    dniCe: zod_1.z.string().optional().refine(v => !v || v.trim() === '' || /^\d{8}$/.test(v.trim()) || /^\d{12}$/.test(v.trim()), 'dniCe inválido (8 o 12 dígitos)')
});
router.post('/', auth_1.authMiddleware, denySysadmin, async (req, res, next) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        const usuario = await prisma_1.prisma.usuario.findUnique({ where: { id: req.userId } });
        if (!usuario || !usuario.activo)
            return res.status(400).json({ error: 'Usuario no válido' });
        const parsed = createLegajoSchema.parse(req.body);
        const codigoValidation = (0, legajo_1.validateCodigo)(parsed.codigo);
        if (!codigoValidation.valid || !codigoValidation.padded) {
            return res.status(400).json({ error: 'Formato de código inválido. Use Letra-Numero (ej. L-5 o L-0005)' });
        }
        const finalCodigo = codigoValidation.padded;
        const exists = await prisma_1.prisma.legajo.findFirst({ where: { codigo: finalCodigo } });
        if (exists)
            return res.status(409).json({ error: 'Código ya existe' });
        let dniCeValue = undefined;
        if (parsed.dniCe !== undefined) {
            const dniValidation = (0, legajo_1.validateDniCe)(parsed.dniCe);
            if (!dniValidation.valid)
                return res.status(400).json({ error: 'dniCe inválido (debe tener 8 o 12 dígitos numéricos)' });
            const trimmed = parsed.dniCe.trim();
            if (trimmed)
                dniCeValue = trimmed;
        }
        if (dniCeValue) {
            const dniExists = await prisma_1.prisma.legajo.findFirst({ where: { dniCe: dniCeValue } });
            if (dniExists)
                return res.status(409).json({ error: 'dniCe ya existe' });
        }
        // Asegurar null explícito cuando no se provee dniCe para consistencia con tests
        const data = { codigo: finalCodigo, titulo: parsed.titulo, descripcion: parsed.descripcion, estado: parsed.estado, usuarioId: req.userId, dniCe: dniCeValue ?? null };
        const created = await legajos_service_1.LegajosService.create(data);
        res.status(201).json(created);
        try {
            global.io?.emit('legajo:created', created);
            (0, logger_1.debug)('[socket] legajo:created', created.id);
        }
        catch { }
    }
    catch (e) {
        next(e);
    }
});
router.put('/:id', auth_1.authMiddleware, denySysadmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const existing = await prisma_1.prisma.legajo.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ error: 'Legajo no encontrado' });
        const updates = {};
        if (req.body.codigo) {
            if (existing.currentHolderId) {
                return res.status(409).json({ error: 'No se puede cambiar el código mientras el legajo está en préstamo' });
            }
            const result = (0, legajo_1.validateCodigo)(String(req.body.codigo));
            if (!result.valid || !result.padded)
                return res.status(400).json({ error: 'Formato de código inválido' });
            const exists = await prisma_1.prisma.legajo.findFirst({ where: { codigo: result.padded, NOT: { id } } });
            if (exists)
                return res.status(409).json({ error: 'Código ya existe' });
            updates.codigo = result.padded;
        }
        if (req.body.titulo !== undefined)
            updates.titulo = req.body.titulo;
        if (req.body.descripcion !== undefined)
            updates.descripcion = req.body.descripcion;
        if (req.body.estado !== undefined)
            updates.estado = req.body.estado;
        if (req.body.dniCe !== undefined) {
            const raw = String(req.body.dniCe).trim();
            if (raw === '') {
                updates.dniCe = null;
            }
            else {
                const v = (0, legajo_1.validateDniCe)(raw);
                if (!v.valid)
                    return res.status(400).json({ error: 'dniCe inválido (solo 8 o 12 dígitos numéricos)' });
                const conflict = await prisma_1.prisma.legajo.findFirst({ where: { dniCe: raw, NOT: { id } } });
                if (conflict)
                    return res.status(409).json({ error: 'dniCe ya existe' });
                updates.dniCe = raw;
            }
        }
        const updated = await legajos_service_1.LegajosService.update(id, updates);
        res.json(updated);
        try {
            global.io?.emit('legajo:updated', updated);
            (0, logger_1.debug)('[socket] legajo:updated', updated.id);
        }
        catch { }
    }
    catch (e) {
        next(e);
    }
});
router.delete('/:id', auth_1.authMiddleware, denySysadmin, async (req, res, next) => { try {
    const id = Number(req.params.id);
    await legajos_service_1.LegajosService.delete(id);
    res.status(204).send();
    try {
        global.io?.emit('legajo:deleted', { id });
        (0, logger_1.debug)('[socket] legajo:deleted', id);
    }
    catch { }
}
catch (e) {
    next(e);
} });
// Desbloquear legajo bloqueado (admin) con motivo de recuperación
const unlockSchema = zod_1.z.object({ reason: zod_1.z.string().min(2, 'Motivo muy corto').max(500, 'Motivo muy largo') });
router.post('/:id/unlock', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const parsed = unlockSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
        }
        const legajo = await prisma_1.prisma.legajo.findUnique({ where: { id } });
        if (!legajo)
            return res.status(404).json({ error: 'Legajo no encontrado' });
        if (legajo.estado !== 'blocked')
            return res.status(409).json({ error: 'El legajo no está bloqueado' });
        const updated = await prisma_1.prisma.legajo.update({ where: { id }, data: { estado: 'available' } });
        await prisma_1.prisma.legajoRecoveryHistory.create({ data: { legajoId: id, usuarioId: req.userId, reason: parsed.data.reason } });
        res.json(updated);
        try {
            global.io?.emit('legajo:updated', updated);
            (0, logger_1.debug)('[socket] legajo:updated (unlock)', updated.id);
        }
        catch { }
    }
    catch (e) {
        next(e);
    }
});
// Listar historial de recuperaciones (admin)
router.get('/:id/recoveries', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const records = await prisma_1.prisma.legajoRecoveryHistory.findMany({ where: { legajoId: id }, orderBy: { createdAt: 'desc' }, include: { usuario: true } });
        res.json(records.map((r) => ({ id: r.id, legajoId: r.legajoId, usuarioId: r.usuarioId, usuarioNombre: r.usuario.nombre, reason: r.reason, createdAt: r.createdAt })));
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
