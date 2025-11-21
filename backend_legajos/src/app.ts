import express, { Request, Response } from 'express';
import { router as apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

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

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Backend Legajos API' });
});

// Spark runtime compatibility stubs
app.get('/_spark/user', (_req: Request, res: Response) => {
  // Return minimal anonymous user info; frontend will ignore if not needed
  res.json({ anonymous: true });
});

app.post('/_spark/loaded', (req: Request, res: Response) => {
  // Accept telemetry payload silently
  res.status(200).json({ ok: true });
});

app.use('/api', apiRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

// Central error handler (Zod + generic)
app.use(errorHandler);
