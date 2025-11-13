import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from './auth';

export function requireRole(roleName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const user = await prisma.usuario.findUnique({ where: { id: req.userId }, include: { rol: true } });
    if (!user || user.rol?.nombre !== roleName) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
}
