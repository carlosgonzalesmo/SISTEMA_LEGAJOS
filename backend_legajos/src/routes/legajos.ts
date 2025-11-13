import { Router } from 'express';
import { LegajosService } from '../services/legajos.service';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.get('/', authMiddleware, async (req, res, next) => {
	try {
		const { estado, usuarioId, search, page = '1', pageSize = '20' } = req.query as Record<string, string>;
		const pageNum = Math.max(1, parseInt(page, 10) || 1);
		const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
		const where: any = {};
		if (estado) where.estado = estado;
		if (usuarioId) where.usuarioId = Number(usuarioId);
		if (search) where.titulo = { contains: search, mode: 'insensitive' };
		const total = await LegajosService.count(where);
		const data = await LegajosService.listPaged(where, pageNum, sizeNum);
		res.json({ page: pageNum, pageSize: sizeNum, total, data });
	} catch (e) { next(e); }
});
router.get('/:id', authMiddleware, async (req, res, next) => { try { res.json(await LegajosService.get(Number(req.params.id))); } catch (e) { next(e); } });
const createLegajoSchema = z.object({
	titulo: z.string().min(2),
	descripcion: z.string().optional(),
	usuarioId: z.number().int(),
	estado: z.string().min(2)
});
router.post('/', authMiddleware, async (req, res, next) => { try { const parsed = createLegajoSchema.parse(req.body); res.status(201).json(await LegajosService.create(parsed)); } catch (e) { next(e); } });
router.put('/:id', authMiddleware, async (req, res, next) => { try { res.json(await LegajosService.update(Number(req.params.id), req.body)); } catch (e) { next(e); } });
router.delete('/:id', authMiddleware, async (req, res, next) => { try { await LegajosService.delete(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); } });

export default router;
