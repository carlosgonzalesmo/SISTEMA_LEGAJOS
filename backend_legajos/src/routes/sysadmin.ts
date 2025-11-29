import { Router } from 'express';
import usuariosRouter from './usuarios';
import rolesRouter from './roles';
import settingsRouter from './settings';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

// Agrupa rutas de gobernanza (gestión de usuarios, roles y configuración del sistema).
// Se aplica un guard global sysadmin; así, /sysadmin/* queda reservado.
// NOTA: Las rutas legacy (/usuarios, /roles, /settings) permanecen montadas para compatibilidad y
// para permitir lectura de settings por otros roles mientras se migra el frontend.
const sysadminRouter = Router();

sysadminRouter.use(authMiddleware, requireRole('sysadmin'));

sysadminRouter.use('/usuarios', usuariosRouter);
sysadminRouter.use('/roles', rolesRouter);
sysadminRouter.use('/settings', settingsRouter);

export default sysadminRouter;
