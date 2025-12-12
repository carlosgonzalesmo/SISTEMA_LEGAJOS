import { Router } from 'express';
import { runImport, getImportStatus, runPreview } from '../services/import.service';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

export const importRouter = Router();

// Admin-only sync trigger
importRouter.post('/sync', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const userId = (req as any).userId as number;
    const indices = Array.isArray(req.body?.indices) ? (req.body.indices as number[]) : undefined;
    const onlyNew = String(req.body?.onlyNew ?? 'true').toLowerCase() !== 'false';
    const force = Boolean(req.body?.force ?? false);
    const summary = await runImport(Number(userId), indices, { onlyNew, force });
    return res.json(summary);
  } catch (e: any) {
    const msg = e?.message || 'Import error';
    // Cooldown produces a user-facing error; use 429
    if (msg.toLowerCase().includes('cooldown')) return res.status(429).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

// Admin-only status
importRouter.get('/status', authMiddleware, requireRole('admin'), async (_req, res) => {
  try {
    const status = await getImportStatus();
    return res.json(status);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to read import status' });
  }
});

// Admin-only preview (dry-run)
importRouter.get('/preview', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const page = Number(req.query.page || '1');
    const pageSize = Number(req.query.pageSize || '0') || undefined;
    const onlyNew = String(req.query.onlyNew || 'true').toLowerCase() !== 'false';
    const preview = await runPreview(prisma, undefined, { page, pageSize, onlyNew });
    return res.json(preview);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to run preview' });
  }
});

// Admin-only: reset lastRowIndex
importRouter.post('/reset-lastrow', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const value = req.body?.value;
    const idx = value !== undefined ? Math.max(0, Number(value)) : 0;
    const prisma = req.app.get('prisma');
    await prisma.systemSetting.upsert({
      where: { key: 'import_last_row_index' },
      update: { value: String(idx) },
      create: { key: 'import_last_row_index', value: String(idx) },
    });
    return res.json({ ok: true, lastRowIndex: idx });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to reset lastRowIndex' });
  }
});
