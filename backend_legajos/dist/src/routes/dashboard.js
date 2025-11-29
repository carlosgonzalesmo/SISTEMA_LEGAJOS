"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const prisma_1 = require("../prisma");
const logger_1 = require("../lib/logger");
// Dashboard metrics route (operational domain)
// Exposes aggregated counts for admins. Sysadmin is denied (governance separation).
const router = (0, express_1.Router)();
async function isSysadmin(userId) {
    const u = await prisma_1.prisma.usuario.findUnique({ where: { id: userId } });
    if (!u)
        return false;
    const rol = await prisma_1.prisma.rol.findUnique({ where: { id: u.rolId } });
    return rol?.nombre?.toLowerCase() === 'sysadmin';
}
router.get('/metrics', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res, next) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        // Governance users should not hit operational metrics
        if (await isSysadmin(req.userId))
            return res.status(403).json({ error: 'No autorizado' });
        const [pendingSolicitudes, approvedSolicitudes, completedSolicitudes, rejectedSolicitudes, activeLoans, pendingReturnLegajos, blockedLegajos, requestedLegajos, availableLegajos, totalLegajos] = await Promise.all([
            prisma_1.prisma.solicitud.count({ where: { status: 'PENDING' } }),
            prisma_1.prisma.solicitud.count({ where: { status: 'APPROVED' } }),
            prisma_1.prisma.solicitud.count({ where: { status: 'COMPLETED' } }),
            prisma_1.prisma.solicitud.count({ where: { status: 'REJECTED' } }),
            prisma_1.prisma.legajo.count({ where: { estado: 'on-loan' } }),
            prisma_1.prisma.legajo.count({ where: { estado: 'pending-return' } }),
            prisma_1.prisma.legajo.count({ where: { estado: 'blocked' } }),
            prisma_1.prisma.legajo.count({ where: { estado: 'requested' } }),
            prisma_1.prisma.legajo.count({ where: { estado: 'available' } }),
            prisma_1.prisma.legajo.count({})
        ]);
        let maxLoansPerUser = null;
        try {
            const setting = await prisma_1.prisma.systemSetting.findUnique({ where: { key: 'max_loans_per_user' } });
            if (setting) {
                const v = Number(setting.value);
                if (!Number.isNaN(v) && v > 0)
                    maxLoansPerUser = v;
            }
        }
        catch (e) {
            (0, logger_1.debug)('Dashboard metrics: systemSetting read error', e);
        }
        res.json({
            timestamp: new Date().toISOString(),
            pendingSolicitudes,
            approvedSolicitudes,
            completedSolicitudes,
            rejectedSolicitudes,
            activeLoans,
            pendingReturnLegajos,
            blockedLegajos,
            requestedLegajos,
            availableLegajos,
            totalLegajos,
            maxLoansPerUser
        });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
