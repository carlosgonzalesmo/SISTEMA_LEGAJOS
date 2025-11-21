import { Router } from 'express';
import { LegajosService } from '../services/legajos.service';
import { createSocketServer } from '../socket'; // to satisfy imports if needed
import { Server } from 'socket.io';
const io: Server | undefined = (global as any).io;
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { debug } from '../lib/logger';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

async function denySysadmin(req: AuthRequest, res: any, next: any) {
	try {
		if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
		const u = await prisma.usuario.findUnique({ where: { id: req.userId } });
		if (u) {
			const r = await prisma.rol.findUnique({ where: { id: u.rolId } });
			if (r?.nombre?.toLowerCase() === 'sysadmin') return res.status(403).json({ error: 'No autorizado' });
		}
		next();
	} catch (e) { next(e); }
}

router.get('/', authMiddleware, denySysadmin, async (req, res, next) => {
	try {
		const { estado, usuarioId, search, page = '1', pageSize = '20' } = req.query as Record<string, string>;
		const pageNum = Math.max(1, parseInt(page, 10) || 1);
		const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
		const where: any = {};
		if (estado) where.estado = estado;
		if (usuarioId) where.usuarioId = Number(usuarioId);
		if (search) {
			where.OR = [
				{ codigo: { contains: search, mode: 'insensitive' } },
				{ titulo: { contains: search, mode: 'insensitive' } },
				{ descripcion: { contains: search, mode: 'insensitive' } },
				{ dniCe: { contains: search } }
			];
		}
		const total = await LegajosService.count(where);
		const data = await LegajosService.listPaged(where, pageNum, sizeNum);
		res.json({ page: pageNum, pageSize: sizeNum, total, data });
	} catch (e) { next(e); }
});
router.get('/:id', authMiddleware, denySysadmin, async (req, res, next) => { try { res.json(await LegajosService.get(Number(req.params.id))); } catch (e) { next(e); } });
// Historial de titulares (solo admin)
router.get('/:id/holder-history', authMiddleware, async (req: AuthRequest, res, next) => {
	try {
		if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
		// Verificar rol admin
		const user = await prisma.usuario.findUnique({ where: { id: req.userId } });
		if (!user) return res.status(401).json({ error: 'Usuario inválido' });
		const rol = await prisma.rol.findUnique({ where: { id: user.rolId } });
		if (rol?.nombre?.toLowerCase() !== 'admin') return res.status(403).json({ error: 'No autorizado' });
		const legajoId = Number(req.params.id);
		const history = await prisma.legajoHolderHistory.findMany({ where: { legajoId }, orderBy: { startedAt: 'desc' }, include: { usuario: true } });
		res.json(history.map(h => ({ id: h.id, legajoId: h.legajoId, usuarioId: h.usuarioId, usuarioNombre: h.usuario.nombre, startedAt: h.startedAt, endedAt: h.endedAt })));
	} catch (e) { next(e); }
});
// Lookup por código (normaliza padding)
router.get('/by-codigo/:codigo', authMiddleware, denySysadmin, async (req, res, next) => {
	try {
		let raw = String(req.params.codigo).toUpperCase().trim();
		const regex = /^([A-Z])-(\d+)$/;
		const m = raw.match(regex);
		if (!m) return res.status(400).json({ error: 'Formato inválido' });
		const padded = `${m[1]}-${parseInt(m[2],10).toString().padStart(4,'0')}`;
		const legajo = await prisma.legajo.findFirst({ where: { codigo: padded }, include: { usuario: true, archivos: true } });
		if (!legajo) return res.status(404).json({ error: 'No encontrado' });
		res.json(legajo);
	} catch (e) { next(e); }
});
// usuarioId ya no se acepta desde el body para evitar spoof. Se toma del token.
const createLegajoSchema = z.object({
	codigo: z.string().min(3), // e.g. L-5 or L-0005
	titulo: z.string().min(2), // nombre descriptivo
	descripcion: z.string().optional(),
	estado: z.string().min(2),
	dniCe: z.string().optional() // DNI (8) o CE (12) dígitos
});
router.post('/', authMiddleware, denySysadmin, async (req: AuthRequest, res, next) => {
	try {
		// Instrumentación para diagnosticar problema de dniCe en producción (Railway)
		console.log('[LEGajos POST] body recibido=', req.body);
		if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
		const usuario = await prisma.usuario.findUnique({ where: { id: req.userId } });
		if (!usuario || !usuario.activo) return res.status(400).json({ error: 'Usuario no válido' });
		const parsed = createLegajoSchema.parse(req.body);
		console.log('[LEGajos POST] parsed.dniCe=', parsed.dniCe);
		// Validar formato: 1 letra, guion, número (sin o con padding). Ej: L-5, A-12, C-0007
		const regex = /^[A-Z]-\d+$/;
		if (!regex.test(parsed.codigo.toUpperCase())) {
			return res.status(400).json({ error: 'Formato de código inválido. Use Letra-Numero (ej. L-5 o L-0005)' });
		}
		const [letra, numeroStr] = parsed.codigo.toUpperCase().split('-');
		const numero = parseInt(numeroStr, 10);
		if (isNaN(numero) || numero < 0) return res.status(400).json({ error: 'Número inválido en código' });
		// Normalizar a 4 dígitos para orden lexicográfico estable
		const padded = numero.toString().padStart(4, '0');
		const finalCodigo = `${letra}-${padded}`;
		// Unicidad usando campo titulo (hasta migrar esquema con columna dedicada)
		const exists = await prisma.legajo.findFirst({ where: { codigo: finalCodigo } });
		if (exists) return res.status(409).json({ error: 'Código ya existe' });
		let dniCeValue: string|undefined = undefined;
		if (parsed.dniCe !== undefined) {
			const raw = parsed.dniCe.trim();
			if (raw.length > 0) {
				if (!/^\d{8}$/.test(raw) && !/^\d{12}$/.test(raw)) {
					return res.status(400).json({ error: 'dniCe inválido (debe tener 8 o 12 dígitos numéricos)' });
				}
				dniCeValue = raw;
			}
		}
		console.log('[LEGajos POST] dniCeValue provisional=', dniCeValue);
		if (dniCeValue) {
			const dniExists = await prisma.legajo.findFirst({ where: { dniCe: dniCeValue } });
			if (dniExists) return res.status(409).json({ error: 'dniCe ya existe' });
		}
		const data = { codigo: finalCodigo, titulo: parsed.titulo, descripcion: parsed.descripcion, estado: parsed.estado, usuarioId: req.userId, dniCe: dniCeValue };
		console.log('[LEGajos POST] objeto create data=', data);
		const created = await LegajosService.create(data);
		// Añadir headers de depuración para entorno remoto (Railway)
		res.set('X-Debug-DniCe-In', String(parsed.dniCe));
		res.set('X-Debug-DniCe-Value', String(dniCeValue));
		res.set('X-Debug-DniCe-Saved', String(created.dniCe));
		console.log('[LEGajos POST] creado dniCe=', created.dniCe);
		res.status(201).json(created);
		try { (global as any).io?.emit('legajo:created', created); debug('[socket] legajo:created', created.id); } catch {}
	} catch (e) { next(e); }
});
router.put('/:id', authMiddleware, denySysadmin, async (req: AuthRequest, res, next) => {
	try {
		console.log('[LEGajos PUT] body recibido=', req.body);
		const id = Number(req.params.id);
		const existing = await prisma.legajo.findUnique({ where: { id } });
		if (!existing) return res.status(404).json({ error: 'Legajo no encontrado' });
		const updates: any = {};
		if (req.body.codigo) {
			// Bloquear cambio de código mientras está prestado (tiene currentHolder)
			if (existing.currentHolderId) {
				return res.status(409).json({ error: 'No se puede cambiar el código mientras el legajo está en préstamo' });
			}
			const codigoRaw = String(req.body.codigo).toUpperCase();
			const regex = /^[A-Z]-\d+$/;
			if (!regex.test(codigoRaw)) return res.status(400).json({ error: 'Formato de código inválido' });
			const [letra, numeroStr] = codigoRaw.split('-');
			const numero = parseInt(numeroStr, 10);
			if (isNaN(numero) || numero < 0) return res.status(400).json({ error: 'Número inválido en código' });
			const padded = numero.toString().padStart(4, '0');
			const finalCodigo = `${letra}-${padded}`;
			const exists = await prisma.legajo.findFirst({ where: { codigo: finalCodigo, NOT: { id } } });
			if (exists) return res.status(409).json({ error: 'Código ya existe' });
			updates.codigo = finalCodigo;
		}
		if (req.body.titulo !== undefined) updates.titulo = req.body.titulo;
		if (req.body.descripcion !== undefined) updates.descripcion = req.body.descripcion;
		if (req.body.estado !== undefined) updates.estado = req.body.estado;
		if (req.body.dniCe !== undefined) {
			const raw = String(req.body.dniCe).trim();
			if (raw === '') {
				updates.dniCe = null; // permitir limpiar
			} else {
				if (!/^\d{8}$/.test(raw) && !/^\d{12}$/.test(raw)) return res.status(400).json({ error: 'dniCe inválido (solo 8 o 12 dígitos numéricos)' });
				// Verificar unicidad
				const conflict = await prisma.legajo.findFirst({ where: { dniCe: raw, NOT: { id } } });
				if (conflict) return res.status(409).json({ error: 'dniCe ya existe' });
				updates.dniCe = raw;
			}
		}
		console.log('[LEGajos PUT] updates finales=', updates);
		const updated = await LegajosService.update(id, updates);
		res.set('X-Debug-DniCe-In', String(req.body.dniCe));
		res.set('X-Debug-DniCe-Saved', String(updated.dniCe));
		res.set('X-Debug-DniCe-Updates', JSON.stringify(updates));
		console.log('[LEGajos PUT] actualizado dniCe=', updated.dniCe);
		res.json(updated);
		try { (global as any).io?.emit('legajo:updated', updated); debug('[socket] legajo:updated', updated.id); } catch {}
	} catch (e) { next(e); }
});
router.delete('/:id', authMiddleware, denySysadmin, async (req, res, next) => { try { const id = Number(req.params.id); await LegajosService.delete(id); res.status(204).send(); try { (global as any).io?.emit('legajo:deleted', { id }); debug('[socket] legajo:deleted', id); } catch {} } catch (e) { next(e); } });

// Desbloquear legajo bloqueado (admin) con motivo de recuperación
const unlockSchema = z.object({ reason: z.string().min(2, 'Motivo muy corto').max(500, 'Motivo muy largo') });
router.post('/:id/unlock', authMiddleware, requireRole('admin'), async (req: AuthRequest, res, next) => {
	try {
		const id = Number(req.params.id);
		const parsed = unlockSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
		}
		const legajo = await prisma.legajo.findUnique({ where: { id } });
		if (!legajo) return res.status(404).json({ error: 'Legajo no encontrado' });
		if (legajo.estado !== 'blocked') return res.status(409).json({ error: 'El legajo no está bloqueado' });
		const updated = await prisma.legajo.update({ where: { id }, data: { estado: 'available' } });
		await prisma.legajoRecoveryHistory.create({ data: { legajoId: id, usuarioId: req.userId as number, reason: parsed.data.reason } });
		res.json(updated);
		try { (global as any).io?.emit('legajo:updated', updated); debug('[socket] legajo:updated (unlock)', updated.id); } catch {}
	} catch (e) { next(e); }
});

// Listar historial de recuperaciones (admin)
router.get('/:id/recoveries', authMiddleware, requireRole('admin'), async (req: AuthRequest, res, next) => {
	try {
		const id = Number(req.params.id);
		const records = await prisma.legajoRecoveryHistory.findMany({ where: { legajoId: id }, orderBy: { createdAt: 'desc' }, include: { usuario: true } });
		res.json(records.map(r => ({ id: r.id, legajoId: r.legajoId, usuarioId: r.usuarioId, usuarioNombre: r.usuario.nombre, reason: r.reason, createdAt: r.createdAt })));
	} catch (e) { next(e); }
});

export default router;
