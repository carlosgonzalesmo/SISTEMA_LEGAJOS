"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const prisma_1 = require("../prisma");
function requireRole(roleName) {
    return async (req, res, next) => {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        const user = await prisma_1.prisma.usuario.findUnique({ where: { id: req.userId }, include: { rol: true } });
        if (!user || user.rol?.nombre !== roleName) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        next();
    };
}
