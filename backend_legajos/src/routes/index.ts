import { Router } from 'express';
import usuariosRouter from './usuarios';
import rolesRouter from './roles';
import legajosRouter from './legajos';
import archivosRouter from './archivos';
import authRouter from './auth';
import workflowRouter from './workflow';
import settingsRouter from './settings';
import importExcelRouter from './importExcel';
import importCsvRouter from './importCsv';
// New grouped routers (architectural separation)
import adminRouter from './admin';
import sysadminRouter from './sysadmin';

export const router = Router();

// Legacy mounts (kept for backward compatibility / existing frontend calls)
router.use('/usuarios', usuariosRouter);
router.use('/roles', rolesRouter);
router.use('/legajos', legajosRouter);
router.use('/archivos', archivosRouter);
router.use('/auth', authRouter);
router.use('/workflow', workflowRouter);
router.use('/settings', settingsRouter);
router.use('/import', importExcelRouter);
router.use('/import-csv', importCsvRouter);

// New hierarchical architecture (phase 1):
// /admin -> operational domain (legajos CRUD, archivos, workflow lifecycle)
// /sysadmin -> governance domain (usuarios, roles, system settings)
// NOTE: We intentionally DO NOT gate /admin with admin-only to preserve user access
// to workflow creation endpoints. Existing per-route guards (denySysadmin, requireRole('admin')) remain.
router.use('/admin', adminRouter);
router.use('/sysadmin', sysadminRouter);
