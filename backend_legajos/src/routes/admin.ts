import { Router } from 'express';
import legajosRouter from './legajos';
import archivosRouter from './archivos';
import workflowRouter from './workflow';
import { importRouter } from './import';

// Agrupa rutas operativas (dominio "operacional")
// Se mantiene sin middleware de rol global para que usuarios (role=user) puedan
// seguir creando solicitudes y devoluciones vía /admin/workflow/*.
// Las restricciones específicas permanecen dentro de cada sub‑router:
//  - denySysadmin en legajos/workflow evita acceso de sysadmin.
//  - requireRole('admin') en acciones administrativas puntuales.
const adminRouter = Router();

adminRouter.use('/legajos', legajosRouter);
adminRouter.use('/archivos', archivosRouter);
adminRouter.use('/workflow', workflowRouter);
adminRouter.use('/import', importRouter);

export default adminRouter;
