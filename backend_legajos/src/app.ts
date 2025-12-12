import express, { Request, Response } from 'express';
import { router as apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './prisma';

export const app = express();

// CORS configuration (manual to ensure headers with Express 5)
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5000';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Expose Prisma client on app for routers that require it (e.g., import preview)
app.set('prisma', prisma);

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Backend Legajos API' });
});

// Removed Spark telemetry endpoints (/_spark/user, /_spark/loaded)

app.use('/api', apiRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

// Central error handler (Zod + generic)
app.use(errorHandler);
