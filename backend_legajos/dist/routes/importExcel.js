"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const prisma_1 = require("../prisma");
const import_service_1 = require("../services/import.service");
const router = (0, express_1.Router)();
const maxUploadMb = Number(process.env.IMPORT_MAX_UPLOAD_MB || '10');
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: maxUploadMb * 1024 * 1024 },
});
function sheetToValues(buffer, sheetIndex = 0) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheets = wb.SheetNames || [];
    if (!sheets.length)
        return [];
    const name = sheets[Math.max(0, Math.min(sheetIndex, sheets.length - 1))];
    const ws = wb.Sheets[name];
    const arr = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    return arr.map(row => row.map(cell => (cell == null ? '' : String(cell))));
}
async function mapValuesToImportRows(values, startIndex = 0, maxRows) {
    // Reuse the mapping from import.service via dynamic import
    const svc = await Promise.resolve().then(() => __importStar(require('../services/import.service')));
    const getImportColumnIndexes = svc.getImportColumnIndexes;
    const map = await getImportColumnIndexes();
    const letterToIndex = svc.letterToIndex;
    const idxFile = letterToIndex(map.fileNumber);
    const idxDni = letterToIndex(map.dniCe);
    const idxApe = letterToIndex(map.apellidos);
    const idxNom = letterToIndex(map.nombres);
    const upper = typeof maxRows === 'number' ? startIndex + Math.max(0, maxRows) : values.length;
    const rows = [];
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
router.post('/upload', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'Archivo .xlsx requerido' });
        const sheetIndex = Number(process.env.IMPORT_SHEET_INDEX || '0');
        const values = sheetToValues(req.file.buffer, sheetIndex);
        const limit = Number(process.env.IMPORT_ROW_LIMIT || '5000');
        let lastRowIndex = 0;
        try {
            const s = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
            if (s?.value)
                lastRowIndex = Math.max(0, Number(s.value));
        }
        catch { }
        const rows = await mapValuesToImportRows(values, lastRowIndex, limit);
        const preview = await (0, import_service_1.runPreview)(prisma_1.prisma, rows, { page: 1, pageSize: rows.length, onlyNew: false });
        res.json({ ok: true, summary: preview.summary });
    }
    catch (e) {
        next(e);
    }
});
// Commit Excel import (same mapping)
router.post('/commit', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), upload.single('file'), async (req, res, next) => {
    try {
        const indicesParam = (req.body?.indices ?? req.query?.indices);
        const selectedIndices = Array.isArray(indicesParam)
            ? indicesParam.map((x) => Number(x)).filter((n) => Number.isFinite(n))
            : typeof indicesParam === 'string'
                ? indicesParam.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n))
                : [];
        if (!req.file)
            return res.status(400).json({ error: 'Archivo .xlsx requerido' });
        const sheetIndex = Number(process.env.IMPORT_SHEET_INDEX || '0');
        const values = sheetToValues(req.file.buffer, sheetIndex);
        const limit = Number(process.env.IMPORT_ROW_LIMIT || '5000');
        let lastRowIndex = 0;
        try {
            const s = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
            if (s?.value)
                lastRowIndex = Math.max(0, Number(s.value));
        }
        catch { }
        const rows = await mapValuesToImportRows(values, lastRowIndex, limit);
        // Use current user as admin actor
        const adminUserId = req.userId;
        const preview = await (0, import_service_1.runPreview)(prisma_1.prisma, rows, { page: 1, pageSize: rows.length, onlyNew: false });
        let candidates = preview.summary?.candidates;
        if (selectedIndices.length > 0) {
            const set = new Set(selectedIndices);
            candidates = candidates.filter(r => set.has(r.index));
        }
        // Inserción manual respetando candidatos seleccionados
        let inserted = 0;
        const codes = new Set();
        const dnis = new Set();
        const existing = await prisma_1.prisma.legajo.findMany({ select: { codigo: true, dniCe: true } });
        existing.forEach((e) => { if (e.codigo)
            codes.add(e.codigo); if (e.dniCe)
            dnis.add(e.dniCe); });
        for (const c of candidates) {
            const codigo = c.codigo;
            const nombre = c.nombre;
            const dniCe = c.dniCe || null;
            if (!codigo || !nombre)
                continue;
            if (codes.has(codigo) || (dniCe && dnis.has(dniCe)))
                continue;
            try {
                await prisma_1.prisma.legajo.create({ data: { codigo, titulo: nombre, descripcion: null, dniCe, estado: 'available', usuarioId: adminUserId } });
                inserted += 1;
                codes.add(codigo);
                if (dniCe)
                    dnis.add(dniCe);
            }
            catch { /* skip on conflict */ }
        }
        const summary = preview.summary;
        // Advance lastRowIndex by processed count (same strategy as Google Sheets import)
        try {
            const currentSetting = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'import_last_row_index' } });
            const current = currentSetting?.value ? Math.max(0, Number(currentSetting.value)) : 0;
            const next = current + (summary?.processedCount || rows.length);
            await prisma_1.prisma.systemSetting.upsert({
                where: { key: 'import_last_row_index' },
                update: { value: String(next) },
                create: { key: 'import_last_row_index', value: String(next) },
            });
        }
        catch { }
        return res.json({ ok: true, inserted, summary });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
