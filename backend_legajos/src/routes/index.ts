import { Router } from 'express';
import usuariosRouter from './usuarios';
import rolesRouter from './roles';
import legajosRouter from './legajos';
import archivosRouter from './archivos';
import authRouter from './auth';
import workflowRouter from './workflow';
import settingsRouter from './settings';

export const router = Router();

router.use('/usuarios', usuariosRouter);
router.use('/roles', rolesRouter);
router.use('/legajos', legajosRouter);
router.use('/archivos', archivosRouter);
router.use('/auth', authRouter);
router.use('/workflow', workflowRouter);
router.use('/settings', settingsRouter);
