import { Router } from 'express';
import { RolesService } from '../services/roles.service';
import { authMiddleware } from '../middleware/auth';
import { requireRole, requireAnyRole } from '../middleware/roles';

const router = Router();

router.get('/', authMiddleware, requireRole('sysadmin'), async (_req, res, next) => { try { res.json(await RolesService.list()); } catch (e) { next(e); } });
router.post('/', authMiddleware, requireRole('sysadmin'), async (req, res, next) => { try { res.status(201).json(await RolesService.create({ nombre: req.body.nombre })); } catch (e) { next(e); } });

export default router;
