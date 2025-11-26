"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../prisma");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Only sysadmin can manage settings; admins/users can read
async function isSysadmin(userId) {
    const u = await prisma_1.prisma.usuario.findUnique({ where: { id: userId } });
    if (!u)
        return false;
    const rol = await prisma_1.prisma.rol.findUnique({ where: { id: u.rolId } });
    return rol?.nombre?.toLowerCase() === 'sysadmin';
}
// Read single setting
router.get('/:key', auth_1.authMiddleware, async (req, res, next) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        const key = String(req.params.key);
        const setting = await prisma_1.prisma.systemSetting.findUnique({ where: { key } });
        if (!setting)
            return res.status(404).json({ error: 'Setting no encontrado' });
        res.json(setting);
    }
    catch (e) {
        next(e);
    }
});
// Upsert setting (sysadmin only)
const upsertSchema = zod_1.z.object({
    value: zod_1.z.string()
});
router.put('/:key', auth_1.authMiddleware, async (req, res, next) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        if (!(await isSysadmin(req.userId)))
            return res.status(403).json({ error: 'No autorizado' });
        const key = String(req.params.key);
        const { value } = upsertSchema.parse(req.body);
        const setting = await prisma_1.prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
        res.json(setting);
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
