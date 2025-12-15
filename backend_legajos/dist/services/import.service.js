"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCodigo = normalizeCodigo;
exports.normalizeDniCe = normalizeDniCe;
exports.letterToIndex = letterToIndex;
exports.getImportColumnIndexes = getImportColumnIndexes;
exports.fetchSheetRows = fetchSheetRows;
exports.runImport = runImport;
exports.runPreview = runPreview;
exports.getImportStatus = getImportStatus;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const prisma_1 = require("../prisma");
function getEnv(name, required = true) {
    const v = process.env[name];
    if (required && (!v || v.length === 0))
        throw new Error(`Missing env: ${name}`);
    return v;
}
function normalizeCodigo(raw) {
    if (!raw)
        return null;
    const s = String(raw).trim().toUpperCase();
    // Accept formats like L-1, L-0001, A-12, etc. Expect single letter, hyphen, number
    const m = s.match(/^([A-Z])[- ]?(\d{1,6})$/);
    if (!m)
        return null;
    const letter = m[1];
    const num = m[2].padStart(4, '0');
    return `${letter}-${num}`;
}
function normalizeDniCe(raw) {
    if (!raw)
        return null;
    const s = String(raw).trim();
    if (s.length === 0)
        return null;
    const onlyDigits = s.replace(/\D/g, '');
    if (onlyDigits.length === 8 || onlyDigits.length === 12)
        return onlyDigits;
    return null;
}
function letterToIndex(letterOrIndex) {
    if (typeof letterOrIndex === 'number')
        return Math.max(0, letterOrIndex | 0);
    const s = String(letterOrIndex).trim();
    // If it's a numeric string, parse it
    if (/^\d+$/.test(s))
        return Math.max(0, parseInt(s, 10));
    // Convert Excel-like column letters (A,B,...,Z, AA, AB, ...) to 0-based index
    const up = s.toUpperCase();
    let idx = 0;
    for (let i = 0; i < up.length; i++) {
        const c = up.charCodeAt(i);
        if (c < 65 || c > 90)
            continue; // ignore non-letters
        idx = idx * 26 + (c - 64); // A=1 ... Z=26
    }
    return Math.max(0, idx - 1);
}
async function getImportColumnIndexes() {
    // Default mapping matches current behavior:
    // A: fileNumber, B: dniCe, C: apellidos, D: nombres
    const defaults = {
        fileNumber: 0,
        dniCe: 1,
        apellidos: 2,
        nombres: 3,
        nameOrder: 'apellidos_nombres',
        nameSeparator: ' ',
    };
    // Try SystemSetting first
    try {
        const setting = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_column_indexes' } });
        if (setting?.value) {
            try {
                const parsed = JSON.parse(setting.value);
                return {
                    fileNumber: letterToIndex(parsed.fileNumber ?? defaults.fileNumber),
                    dniCe: letterToIndex(parsed.dniCe ?? defaults.dniCe),
                    apellidos: letterToIndex(parsed.apellidos ?? defaults.apellidos),
                    nombres: letterToIndex(parsed.nombres ?? defaults.nombres),
                    nameOrder: (parsed.nameOrder ?? defaults.nameOrder),
                    nameSeparator: parsed.nameSeparator ?? defaults.nameSeparator,
                };
            }
            catch { /* ignore parse error */ }
        }
    }
    catch { /* ignore db error */ }
    // Then try env var
    try {
        const fromEnv = getEnv('IMPORT_COLUMN_INDEXES', false);
        if (fromEnv) {
            const parsed = JSON.parse(fromEnv);
            return {
                fileNumber: letterToIndex(parsed.fileNumber ?? defaults.fileNumber),
                dniCe: letterToIndex(parsed.dniCe ?? defaults.dniCe),
                apellidos: letterToIndex(parsed.apellidos ?? defaults.apellidos),
                nombres: letterToIndex(parsed.nombres ?? defaults.nombres),
                nameOrder: (parsed.nameOrder ?? defaults.nameOrder),
                nameSeparator: parsed.nameSeparator ?? defaults.nameSeparator,
            };
        }
    }
    catch { /* ignore env parse error */ }
    return defaults;
}
async function fetchSheetRows(maxRows, offset) {
    const base64 = getEnv('GOOGLE_SHEETS_CREDENTIALS_BASE64');
    const sheetId = getEnv('GOOGLE_SHEETS_ID');
    const range = getEnv('GOOGLE_SHEETS_RANGE');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const creds = JSON.parse(json);
    const auth = new google_auth_library_1.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: range });
    let values = (resp.data.values || []);
    const startIndex = Math.max(0, Number(offset || 0));
    const upper = typeof maxRows === 'number' ? startIndex + Math.max(0, maxRows) : values.length;
    // Resolve index-based mapping (no headers assumption)
    const map = await getImportColumnIndexes();
    console.log('Import column mapping:', map);
    const idxFile = letterToIndex(map.fileNumber);
    const idxDni = letterToIndex(map.dniCe);
    const idxApe = letterToIndex(map.apellidos);
    const idxNom = letterToIndex(map.nombres);
    // Map to our internal shape: codigo=fileNumber, dniCe, nombre built from apellidos/nombres, descripcion=null
    const rows = [];
    for (let i = startIndex; i < Math.min(values.length, upper); i++) {
        const row = values[i] || [];
        const fileNumber = (row[idxFile] ?? '').toString();
        const dniCe = row[idxDni] != null ? String(row[idxDni]) : null;
        const apellidos = String(row[idxApe] ?? '').trim();
        const nombres = String(row[idxNom] ?? '').trim();
        let nombre = '';
        if (map.nameOrder === 'nombres_apellidos') {
            nombre = `${nombres}${nombres && apellidos ? map.nameSeparator : ''}${apellidos}`.trim();
        }
        else {
            // default: apellidos_nombres
            nombre = `${apellidos}${apellidos && nombres ? map.nameSeparator : ''}${nombres}`.trim();
        }
        rows.push({
            codigo: fileNumber,
            nombre,
            descripcion: null,
            dniCe,
        });
    }
    return rows;
}
async function runImport(adminUserId, indices, opts) {
    const limit = Number(getEnv('IMPORT_ROW_LIMIT', false) || '5000');
    const cooldownMin = Number(getEnv('IMPORT_COOLDOWN_MINUTES', false) || '0');
    // Cooldown using SystemSetting
    const lastSyncSetting = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_sync_at' } });
    if (!opts?.force && cooldownMin > 0 && lastSyncSetting?.value) {
        const last = new Date(lastSyncSetting.value);
        const diffMin = (Date.now() - last.getTime()) / 60000;
        if (diffMin < cooldownMin) {
            const remaining = Math.ceil(cooldownMin - diffMin);
            throw new Error(`Cooldown active. Try again in ${remaining} minutes.`);
        }
    }
    // Determine offset using lastRowIndex when onlyNew=true
    let lastRowIndex = 0;
    try {
        const s = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
        if (s?.value)
            lastRowIndex = Math.max(0, Number(s.value));
    }
    catch { /* ignore */ }
    const offset = (opts?.onlyNew ?? true) ? lastRowIndex : 0;
    const rawRows = await fetchSheetRows(limit, offset);
    let rows = rawRows.slice(0, limit);
    if (indices && indices.length > 0) {
        const indexSet = new Set(indices);
        rows = rawRows.filter((_, i) => indexSet.has(i)).slice(0, limit);
    }
    // Preload existing codes and dni
    const existing = await prisma_1.prisma.legajo.findMany({ select: { codigo: true, dniCe: true } });
    const codes = new Set(existing.map((e) => e.codigo));
    const dnis = new Set(existing.map((e) => e.dniCe).filter(Boolean));
    const summary = { processedCount: rows.length, insertedCount: 0, skippedCount: 0, skipped: [] };
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const codigo = normalizeCodigo(r.codigo);
        if (!codigo) {
            summary.skipped.push({ index: i, reason: 'invalid_codigo', codigo: r.codigo, dniCe: r.dniCe || undefined, nombre: (r.nombre || '').trim() });
            continue;
        }
        const nombre = (r.nombre || '').trim();
        if (!nombre) {
            summary.skipped.push({ index: i, reason: 'missing_nombre', codigo, dniCe: r.dniCe || undefined, nombre });
            continue;
        }
        let dniCe = normalizeDniCe(r.dniCe);
        // If dni/ce provided but invalid, treat as absent (null) instead of skipping entire row
        if (r.dniCe && !dniCe) {
            dniCe = null;
        }
        if (codes.has(codigo)) {
            summary.skipped.push({ index: i, reason: 'duplicate_codigo', codigo, dniCe: dniCe || undefined, nombre });
            continue;
        }
        if (dniCe && dnis.has(dniCe)) {
            summary.skipped.push({ index: i, reason: 'duplicate_dniCe', codigo, dniCe, nombre });
            continue;
        }
        try {
            await prisma_1.prisma.legajo.create({ data: {
                    codigo,
                    titulo: nombre,
                    descripcion: r.descripcion || null,
                    dniCe: dniCe,
                    estado: 'available',
                    usuarioId: adminUserId,
                } });
            summary.insertedCount += 1;
            codes.add(codigo);
            if (dniCe)
                dnis.add(dniCe);
        }
        catch (e) {
            // Unique constraint or other validation errors
            summary.skipped.push({ index: i, reason: 'insert_failed', codigo, dniCe: dniCe || undefined, nombre });
        }
    }
    summary.skippedCount = summary.skipped.length;
    const nowIso = new Date().toISOString();
    summary.lastSyncAt = nowIso;
    await prisma_1.prisma.systemSetting.upsert({
        where: { key: 'import_last_sync_at' },
        update: { value: nowIso },
        create: { key: 'import_last_sync_at', value: nowIso }
    });
    await prisma_1.prisma.systemSetting.upsert({
        where: { key: 'import_last_summary_json' },
        update: { value: JSON.stringify(summary) },
        create: { key: 'import_last_summary_json', value: JSON.stringify(summary) }
    });
    // Advance lastRowIndex by processed count (simple strategy)
    try {
        const currentSetting = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
        const current = currentSetting?.value ? Math.max(0, Number(currentSetting.value)) : 0;
        const next = current + summary.processedCount;
        await prisma_1.prisma.systemSetting.upsert({
            where: { key: 'import_last_row_index' },
            update: { value: String(next) },
            create: { key: 'import_last_row_index', value: String(next) },
        });
    }
    catch { /* ignore advancing lastRowIndex on failure */ }
    return summary;
}
async function runPreview(prismaClient, injectedRows, opts) {
    // Read sheet rows with pagination and lastRow offset
    const rowLimit = Number(getEnv('IMPORT_ROW_LIMIT', false) || '5000');
    const page = Math.max(1, Number(opts?.page || 1));
    const pageSize = Math.min(rowLimit, Math.max(1, Number(opts?.pageSize || rowLimit)));
    const onlyNew = Boolean(opts?.onlyNew ?? true);
    let lastRowIndex = 0;
    try {
        const s = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
        if (s?.value)
            lastRowIndex = Math.max(0, Number(s.value));
    }
    catch { /* ignore */ }
    const offset = (onlyNew ? lastRowIndex : 0) + ((page - 1) * pageSize);
    const rows = injectedRows ?? await fetchSheetRows(pageSize, offset);
    const processed = [];
    const skipped = [];
    const toInsert = [];
    // Preload existing legajos for conflict detection
    const existing = await prismaClient.legajo.findMany({ select: { codigo: true, dniCe: true } });
    const existingCodigos = new Set(existing.map((e) => e.codigo).filter(Boolean));
    const existingDniCes = new Set((existing.map((e) => e.dniCe).filter(Boolean)));
    // Track duplicates within the sheet
    const seenCodigos = new Set();
    const seenDniCes = new Set();
    rows.forEach((row, index) => {
        const rawCodigo = String(row.codigo || '').trim();
        const nombre = String(row.nombre || '').trim();
        const descripcion = String(row.descripcion || '').trim();
        const dniCeRaw = String(row.dniCe || '').trim();
        const codigo = normalizeCodigo(rawCodigo || '');
        const dniCe = normalizeDniCe(dniCeRaw);
        const base = { index, codigo, dniCe, nombre, descripcion };
        // Empty row
        if (!rawCodigo && !nombre && !descripcion && !dniCeRaw) {
            skipped.push({ ...base, reason: 'empty_row', recommendation: 'Eliminar filas completamente vacías del Sheet.' });
            return;
        }
        // Required: nombre
        if (!nombre) {
            skipped.push({ ...base, reason: 'missing_nombre', recommendation: 'Completar el nombre/título antes de importar.' });
            return;
        }
        // Invalid codigo
        if (!codigo) {
            skipped.push({ ...base, reason: 'invalid_codigo', recommendation: 'Usar formato: Letra-Número (ej. L-0001).' });
            return;
        }
        // Duplicates within sheet
        if (seenCodigos.has(codigo)) {
            skipped.push({ ...base, reason: 'sheet_duplicate_codigo', recommendation: 'Quitar duplicados de código en el Sheet.' });
            return;
        }
        seenCodigos.add(codigo);
        if (dniCe) {
            if (seenDniCes.has(dniCe)) {
                skipped.push({ ...base, reason: 'sheet_duplicate_dniCe', recommendation: 'Quitar duplicados de DNI/CE en el Sheet o dejar vacío si no corresponde.' });
                return;
            }
            seenDniCes.add(dniCe);
        }
        // Conflicts with DB
        if (existingCodigos.has(codigo)) {
            skipped.push({ ...base, reason: 'db_conflict_codigo', recommendation: 'Código ya existe en BD. Cambiar código en el Sheet o omitir.' });
            return;
        }
        if (dniCe && existingDniCes.has(dniCe)) {
            skipped.push({ ...base, reason: 'db_conflict_dniCe', recommendation: 'DNI/CE ya existe en BD. Revisar si corresponde y corregir.' });
            return;
        }
        toInsert.push({ ...base });
        processed.push({ ...base });
    });
    const summary = {
        processedCount: rows.length,
        candidateCount: toInsert.length,
        skippedCount: skipped.length,
        categories: categorizeSkipped(skipped),
        skipped,
        candidates: toInsert,
        truncatedByLimit: 0,
        lastRowIndex,
        page,
        pageSize,
        onlyNew,
    };
    return {
        summary,
    };
}
function categorizeSkipped(items) {
    const byReason = {};
    for (const it of items)
        byReason[it.reason] = (byReason[it.reason] || 0) + 1;
    return byReason;
}
async function getImportStatus() {
    const sheetId = getEnv('GOOGLE_SHEETS_ID', false);
    const range = getEnv('GOOGLE_SHEETS_RANGE', false);
    const cooldownMin = Number(getEnv('IMPORT_COOLDOWN_MINUTES', false) || '0');
    const rowLimit = Number(getEnv('IMPORT_ROW_LIMIT', false) || '5000');
    const s = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_summary_json' } });
    const l = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
    let summary = null;
    let lastSyncAt = undefined;
    let lastRowIndex = undefined;
    if (s?.value) {
        try {
            const full = JSON.parse(s.value);
            // Devuelve solo conteos y marca temporal; evita listar todas las filas omitidas/procesadas
            summary = {
                processedCount: full.processedCount,
                insertedCount: full.insertedCount,
                skippedCount: full.skippedCount,
                lastSyncAt: full.lastSyncAt,
            };
            lastSyncAt = full.lastSyncAt;
        }
        catch {
            summary = null;
        }
    }
    if (l?.value)
        lastRowIndex = Math.max(0, Number(l.value));
    return { sheetId, range, cooldownMin, rowLimit, summary, lastSyncAt, lastRowIndex };
}
