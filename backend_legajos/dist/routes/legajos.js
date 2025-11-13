"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const legajos_service_1 = require("../services/legajos.service");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.get('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { estado, usuarioId, search, page = '1', pageSize = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
        const where = {};
        if (estado)
            where.estado = estado;
        if (usuarioId)
            where.usuarioId = Number(usuarioId);
        if (search)
            where.titulo = { contains: search, mode: 'insensitive' };
        const total = await legajos_service_1.LegajosService.count(where);
        const data = await legajos_service_1.LegajosService.listPaged(where, pageNum, sizeNum);
        res.json({ page: pageNum, pageSize: sizeNum, total, data });
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id', auth_1.authMiddleware, async (req, res, next) => { try {
    res.json(await legajos_service_1.LegajosService.get(Number(req.params.id)));
}
catch (e) {
    next(e);
} });
const createLegajoSchema = zod_1.z.object({
    titulo: zod_1.z.string().min(2),
    descripcion: zod_1.z.string().optional(),
    usuarioId: zod_1.z.number().int(),
    estado: zod_1.z.string().min(2)
});
router.post('/', auth_1.authMiddleware, async (req, res, next) => { try {
    const parsed = createLegajoSchema.parse(req.body);
    res.status(201).json(await legajos_service_1.LegajosService.create(parsed));
}
catch (e) {
    next(e);
} });
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => { try {
    res.json(await legajos_service_1.LegajosService.update(Number(req.params.id), req.body));
}
catch (e) {
    next(e);
} });
router.delete('/:id', auth_1.authMiddleware, async (req, res, next) => { try {
    await legajos_service_1.LegajosService.delete(Number(req.params.id));
    res.status(204).send();
}
catch (e) {
    next(e);
} });
exports.default = router;
