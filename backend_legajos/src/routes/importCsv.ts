import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { prisma } from '../prisma';
import { ImportRow } from '../services/import.service';
import { normalizeCodigo, normalizeDniCe } from '../services/import.service';

const router = Router();

const maxUploadMb = Number(process.env.IMPORT_MAX_UPLOAD_MB || '10');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024 },
});

function parseCsv(buffer: Buffer): ImportRow[] {
  const text = buffer.toString('utf8');
  const rows = parse(text, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as (string | number | null)[][];

  if (!rows || rows.length === 0) return [];

  const toStr = (v: any) => (v == null ? '' : String(v));
  const upper = (s: string) => s.trim().toUpperCase();
  const header = rows[0].map(c => upper(toStr(c)));

  const expectedCodigo = 'CODIGO DE EPP DEL SENTENCIADO';
  const expectedDni = 'DNI';
  const expectedNombre = 'NOMBRE';
  const expectedObsA = 'OBSERVACION';
  const expectedObsB = 'OBSERVACIÓN';

  const hasHeader = header.includes(expectedCodigo) || header.includes(expectedDni) || header.includes(expectedNombre) || header.includes(expectedObsA) || header.includes(expectedObsB);

  // Determine indices by header names (if present) or fixed order 0..3
  let startIndex = 0;
  let idxCodigo = 0, idxDni = 1, idxNombre = 2, idxObs = 3;
  if (hasHeader) {
    startIndex = 1;
    const findIndex = (alts: string[]) => {
      for (const a of alts) {
        const i = header.indexOf(a);
        if (i >= 0) return i;
      }
      return -1;
    };
    idxCodigo = findIndex([expectedCodigo, 'CODIGO']);
    idxDni = findIndex([expectedDni, 'DNI/CE']);
    idxNombre = findIndex([expectedNombre]);
    idxObs = findIndex([expectedObsA, expectedObsB]);
    // Fallback to positional if any missing
    if (idxCodigo < 0) idxCodigo = 0;
    if (idxDni < 0) idxDni = 1;
    if (idxNombre < 0) idxNombre = 2;
    if (idxObs < 0) idxObs = 3;
  }

  const out: ImportRow[] = [];
  for (let i = startIndex; i < rows.length; i++) {
    const r = rows[i] || [];
    const codigo = toStr(r[idxCodigo] ?? '');
    const dniCe = toStr(r[idxDni] ?? '');
    const nombre = toStr(r[idxNombre] ?? '');
    const descripcion = toStr(r[idxObs] ?? '');
    out.push({ codigo, nombre, descripcion, dniCe });
  }
  return out;
}

router.post('/preview', authMiddleware, requireRole('admin'), upload.single('file'), async (req: AuthRequest & { file?: Express.Multer.File }, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo .csv requerido' });
    const rows = parseCsv(req.file.buffer);

    // Preload existing legajos
    const existing = await prisma.legajo.findMany({ select: { codigo: true, dniCe: true } });
    const existingCodigos = new Set(existing.map((e: any) => e.codigo).filter(Boolean));
    const existingDnis = new Set(existing.map((e: any) => e.dniCe).filter(Boolean));

    const seenSheetCodigos = new Set<string>();
    const seenSheetDnis = new Set<string>();

    const candidatesToCreate: any[] = [];
    const candidatesToUpdate: any[] = [];
    const skipped: any[] = [];

    rows.forEach((r, index) => {
      const codigo = normalizeCodigo(r.codigo || '');
      const nombre = (r.nombre || '').trim();
      let dniCe = normalizeDniCe(r.dniCe);
      const descripcion = (r.descripcion || '').trim();

      const base = { index, codigo, nombre, dniCe, descripcion };

      if (!codigo) {
        skipped.push({ ...base, reason: 'invalid_codigo' });
        return;
      }

      // detect duplicates in the sheet
      if (seenSheetCodigos.has(codigo)) {
        skipped.push({ ...base, reason: 'sheet_duplicate_codigo' });
        return;
      }
      seenSheetCodigos.add(codigo);

      if (dniCe) {
        if (seenSheetDnis.has(dniCe)) {
          skipped.push({ ...base, reason: 'sheet_duplicate_dniCe' });
          return;
        }
        seenSheetDnis.add(dniCe);
      }

      if (existingCodigos.has(codigo)) {
        // Update path: descripcion can be updated even if nombre is empty
        candidatesToUpdate.push(base);
        return;
      }

      // Create path: require nombre
      if (!nombre) {
        skipped.push({ ...base, reason: 'missing_nombre' });
        return;
      }

      // If dniCe conflicts with DB, clear it (we prefer creating without dni to avoid unique violation)
      if (dniCe && existingDnis.has(dniCe)) {
        dniCe = null;
      }

      candidatesToCreate.push({ ...base, dniCe });
    });

    const summary = {
      processedCount: rows.length,
      toCreateCount: candidatesToCreate.length,
      toUpdateCount: candidatesToUpdate.length,
      skippedCount: skipped.length,
      categories: categorize(skipped.map(s => s.reason)),
      createCandidates: candidatesToCreate,
      updateCandidates: candidatesToUpdate,
      skipped,
    };

    res.json({ ok: true, summary });
  } catch (e) { next(e); }
});

router.post('/commit', authMiddleware, requireRole('admin'), upload.single('file'), async (req: AuthRequest & { file?: Express.Multer.File }, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo .csv requerido' });
    const rows = parseCsv(req.file.buffer);
    const adminUserId = req.userId as number;

    const existing = await prisma.legajo.findMany({ select: { id: true, codigo: true, dniCe: true } });
    const codigoToId = new Map<string, number>();
    const existingDnis = new Set<string>();
    for (const e of existing as any[]) { if (e.codigo) codigoToId.set(e.codigo, e.id); if (e.dniCe) existingDnis.add(e.dniCe); }

    let insertedCount = 0;
    let updatedCount = 0;
    const skipped: any[] = [];

    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      const codigo = normalizeCodigo(r.codigo || '');
      const nombre = (r.nombre || '').trim();
      let dniCe = normalizeDniCe(r.dniCe);
      const descripcion = (r.descripcion || '').trim();

      const base = { index, codigo, nombre, dniCe, descripcion };

      if (!codigo) { skipped.push({ ...base, reason: 'invalid_codigo' }); continue; }

      const existingId = codigoToId.get(codigo);
      if (existingId) {
        // Update descripcion only (do not alter DNI/CE or titulo unless asked). If empty, set to null.
        try {
          await prisma.legajo.update({ where: { id: existingId }, data: { descripcion: descripcion || null } });
          updatedCount += 1;
        } catch {
          skipped.push({ ...base, reason: 'update_failed' });
        }
        continue;
      }

      // Creation path requires nombre
      if (!nombre) { skipped.push({ ...base, reason: 'missing_nombre' }); continue; }

      // Avoid DNI conflict on create
      if (dniCe && existingDnis.has(dniCe)) dniCe = null;

      try {
        await prisma.legajo.create({
          data: {
            codigo,
            titulo: nombre,
            descripcion: descripcion || null,
            dniCe: dniCe || null,
            estado: 'available',
            usuarioId: adminUserId,
          },
        });
        insertedCount += 1;
        if (dniCe) existingDnis.add(dniCe);
        codigoToId.set(codigo, -1); // mark as existing for subsequent rows
      } catch {
        skipped.push({ ...base, reason: 'insert_failed' });
      }
    }

    res.json({ ok: true, insertedCount, updatedCount, skippedCount: skipped.length, skipped });
  } catch (e) { next(e); }
});

function categorize(reasons: string[]) {
  const out: Record<string, number> = {};
  for (const r of reasons) out[r] = (out[r] || 0) + 1;
  return out;
}

export default router;
