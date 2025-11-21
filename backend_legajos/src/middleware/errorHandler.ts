import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { error as logError } from '../lib/logger';

// Central error handling middleware to reduce repetitive try/catch responses.
// Attach at the end of the middleware chain in app.ts
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos' });
  }
  // Known shape with status
  if (err && typeof err.status === 'number') {
    return res.status(err.status).json({ error: err.message || 'Error' });
  }
  logError('Unhandled error', err);
  return res.status(500).json({ error: 'Error interno' });
}
