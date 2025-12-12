"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importRouter = void 0;
const express_1 = require("express");
const import_service_1 = require("../services/import.service");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
exports.importRouter = (0, express_1.Router)();
// Admin-only sync trigger
exports.importRouter.post('/sync', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res) => {
    try {
        const userId = req.userId;
        const indices = Array.isArray(req.body?.indices) ? req.body.indices : undefined;
        const onlyNew = String(req.body?.onlyNew ?? 'true').toLowerCase() !== 'false';
        const force = Boolean(req.body?.force ?? false);
        const summary = await (0, import_service_1.runImport)(Number(userId), indices, { onlyNew, force });
        return res.json(summary);
    }
    catch (e) {
        const msg = e?.message || 'Import error';
        // Cooldown produces a user-facing error; use 429
        if (msg.toLowerCase().includes('cooldown'))
            return res.status(429).json({ error: msg });
        return res.status(400).json({ error: msg });
    }
});
// Admin-only status
exports.importRouter.get('/status', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (_req, res) => {
    try {
        const status = await (0, import_service_1.getImportStatus)();
        return res.json(status);
    }
    catch (e) {
        return res.status(500).json({ error: 'Failed to read import status' });
    }
});
// Admin-only preview (dry-run)
exports.importRouter.get('/preview', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res) => {
    try {
        const prisma = req.app.get('prisma');
        const page = Number(req.query.page || '1');
        const pageSize = Number(req.query.pageSize || '0') || undefined;
        const onlyNew = String(req.query.onlyNew || 'true').toLowerCase() !== 'false';
        const preview = await (0, import_service_1.runPreview)(prisma, undefined, { page, pageSize, onlyNew });
        return res.json(preview);
    }
    catch (e) {
        return res.status(500).json({ error: e?.message || 'Failed to run preview' });
    }
});
// Admin-only: reset lastRowIndex
exports.importRouter.post('/reset-lastrow', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res) => {
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
    }
    catch (e) {
        return res.status(500).json({ error: e?.message || 'Failed to reset lastRowIndex' });
    }
});
