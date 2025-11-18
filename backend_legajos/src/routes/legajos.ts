import { Router } from 'express';
import { LegajosService } from '../services/legajos.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';
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
				{ titulo: { contains: search, mode: 'insensitive' } }
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
	estado: z.string().min(2)
});
router.post('/', authMiddleware, denySysadmin, async (req: AuthRequest, res, next) => {
	try {
		if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
		const usuario = await prisma.usuario.findUnique({ where: { id: req.userId } });
		if (!usuario || !usuario.activo) return res.status(400).json({ error: 'Usuario no válido' });
		const parsed = createLegajoSchema.parse(req.body);
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
		const data = { codigo: finalCodigo, titulo: parsed.titulo, descripcion: parsed.descripcion, estado: parsed.estado, usuarioId: req.userId };
		res.status(201).json(await LegajosService.create(data));
	} catch (e) { next(e); }
});
router.put('/:id', authMiddleware, denySysadmin, async (req: AuthRequest, res, next) => {
	try {
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
		const updated = await LegajosService.update(id, updates);
		res.json(updated);
	} catch (e) { next(e); }
});
router.delete('/:id', authMiddleware, denySysadmin, async (req, res, next) => { try { await LegajosService.delete(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); } });

export default router;
