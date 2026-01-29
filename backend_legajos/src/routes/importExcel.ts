import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { prisma } from '../prisma';
import { ImportRow, runPreview, runImport } from '../services/import.service';

const router = Router();

const maxUploadMb = Number(process.env.IMPORT_MAX_UPLOAD_MB || '10');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024 },
});

function sheetToValues(buffer: Buffer, sheetIndex = 0): string[][] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheets = wb.SheetNames || [];
  if (!sheets.length) return [];
  const name = sheets[Math.max(0, Math.min(sheetIndex, sheets.length - 1))];
  const ws = wb.Sheets[name];
  const arr = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as (string | number | null | undefined)[][];
  return arr.map(row => row.map(cell => (cell == null ? '' : String(cell))));
}

// Map raw values (string[][]) to ImportRow[] using the same index mapping as Google Sheets
import { normalizeCodigo, normalizeDniCe } from '../services/import.service';

async function mapValuesToImportRows(values: string[][], startIndex = 0, maxRows?: number): Promise<ImportRow[]> {
  // Reuse the mapping from import.service via dynamic import
  const svc = await import('../services/import.service');
  const getImportColumnIndexes = (svc as any).getImportColumnIndexes as () => Promise<any>;
  const map = await getImportColumnIndexes();
  const letterToIndex = (svc as any).letterToIndex as (x: any) => number;
  const idxFile = letterToIndex(map.fileNumber);
  const idxDni = letterToIndex(map.dniCe);
  const idxApe = letterToIndex(map.apellidos);
  const idxNom = letterToIndex(map.nombres);
  const upper = typeof maxRows === 'number' ? startIndex + Math.max(0, maxRows) : values.length;
  const rows: ImportRow[] = [];
  for (let i = startIndex; i < Math.min(values.length, upper); i++) {
    const row = values[i] || [];
    const fileNumber = (row[idxFile] ?? '').toString();
    const dniCe = row[idxDni] != null ? String(row[idxDni]) : null;
    const apellidos = String(row[idxApe] ?? '').trim();
    const nombres = String(row[idxNom] ?? '').trim();
    const sep = map.nameSeparator || ' ';
    const nombre = map.nameOrder === 'nombres_apellidos'
      ? `${nombres}${nombres && apellidos ? sep : ''}${apellidos}`.trim()
      : `${apellidos}${apellidos && nombres ? sep : ''}${nombres}`.trim();
    rows.push({ codigo: fileNumber, nombre, descripcion: null, dniCe });
  }
  return rows;
}

// Upload Excel and return preview summary
router.post('/upload', authMiddleware, requireRole('admin'), upload.single('file'), async (req: AuthRequest & { file?: Express.Multer.File }, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo .xlsx requerido' });
    const sheetIndex = Number(process.env.IMPORT_SHEET_INDEX || '0');
    const values = sheetToValues(req.file.buffer, sheetIndex);
    const limit = Number(process.env.IMPORT_ROW_LIMIT || '5000');
    let lastRowIndex = 0;
    try {
      const s = await prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
      if (s?.value) lastRowIndex = Math.max(0, Number(s.value));
    } catch {}
    const rows = await mapValuesToImportRows(values, lastRowIndex, limit);
    const preview = await runPreview(prisma as any, rows, { page: 1, pageSize: rows.length, onlyNew: false });
    res.json({ ok: true, summary: preview.summary });
  } catch (e) { next(e); }
});

// Commit Excel import (same mapping)
router.post('/commit', authMiddleware, requireRole('admin'), upload.single('file'), async (req: AuthRequest & { file?: Express.Multer.File }, res, next) => {
  try {
    const indicesParam = (req.body?.indices ?? req.query?.indices) as unknown;
    const selectedIndices: number[] = Array.isArray(indicesParam)
      ? (indicesParam as any).map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n))
      : typeof indicesParam === 'string'
        ? indicesParam.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n))
        : [];
    if (!req.file) return res.status(400).json({ error: 'Archivo .xlsx requerido' });
    const sheetIndex = Number(process.env.IMPORT_SHEET_INDEX || '0');
    const values = sheetToValues(req.file.buffer, sheetIndex);
    const limit = Number(process.env.IMPORT_ROW_LIMIT || '5000');
    let lastRowIndex = 0;
    try {
      const s = await prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
      if (s?.value) lastRowIndex = Math.max(0, Number(s.value));
    } catch {}
    const rows = await mapValuesToImportRows(values, lastRowIndex, limit);
    // Use current user as admin actor
    const adminUserId = req.userId as number;
    const preview = await runPreview(prisma as any, rows, { page: 1, pageSize: rows.length, onlyNew: false });
    let candidates = (preview as any).summary?.candidates as any[];
    if (selectedIndices.length > 0) {
      const set = new Set(selectedIndices);
      candidates = candidates.filter(r => set.has(r.index));
    }
    // Inserción manual respetando candidatos seleccionados
    let inserted = 0;
    const codes = new Set<string>();
    const dnis = new Set<string>();
    const existing = await prisma.legajo.findMany({ select: { codigo: true, dniCe: true } });
    existing.forEach((e: any) => { if (e.codigo) codes.add(e.codigo); if (e.dniCe) dnis.add(e.dniCe); });
    for (const c of candidates) {
      const codigo = c.codigo;
      const nombre = c.nombre;
      let dniCe = c.dniCe || null;
      if (!codigo || !nombre) continue;
      // Apply sentinel for empty DNI and avoid unique conflicts
      const sentinel = 'NODOCUMENTADO';
      if (!dniCe) {
        dniCe = dnis.has(sentinel) ? null : sentinel;
      } else if (dnis.has(dniCe)) {
        // For non-sentinel duplicates, skip this candidate
        continue;
      }
      try {
        await prisma.legajo.create({ data: { codigo, titulo: nombre, descripcion: null, dniCe, estado: 'available', usuarioId: adminUserId } });
        inserted += 1; codes.add(codigo); if (dniCe) dnis.add(dniCe);
      } catch { /* skip on conflict */ }
    }
    const summary = (preview as any).summary;
    // Advance lastRowIndex by processed count (same strategy as Google Sheets import)
    try {
      const currentSetting = await prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
      const current = currentSetting?.value ? Math.max(0, Number(currentSetting.value)) : 0;
      const next = current + (summary?.processedCount || rows.length);
      await prisma.systemSetting.upsert({
        where: { key: 'import_last_row_index' },
        update: { value: String(next) },
        create: { key: 'import_last_row_index', value: String(next) },
      });
    } catch {}
    return res.json({ ok: true, inserted, summary });
  } catch (e) { next(e); }
});

export default router;
