import { Router } from 'express';
import { ArchivosService } from '../services/archivos.service';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const createArchivoSchema = z.object({ nombre: z.string().min(1), url: z.string().url(), legajoId: z.number().int() });
router.post('/', authMiddleware, async (req, res, next) => { try { const parsed = createArchivoSchema.parse(req.body); res.status(201).json(await ArchivosService.create(parsed)); } catch (e) { next(e); } });
router.delete('/:id', authMiddleware, async (req, res, next) => { try { await ArchivosService.delete(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); } });

export default router;
