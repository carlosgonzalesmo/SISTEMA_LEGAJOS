"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const archivos_service_1 = require("../services/archivos.service");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const createArchivoSchema = zod_1.z.object({ nombre: zod_1.z.string().min(1), url: zod_1.z.string().url(), legajoId: zod_1.z.number().int() });
router.post('/', auth_1.authMiddleware, async (req, res, next) => { try {
    const parsed = createArchivoSchema.parse(req.body);
    res.status(201).json(await archivos_service_1.ArchivosService.create(parsed));
}
catch (e) {
    next(e);
} });
router.delete('/:id', auth_1.authMiddleware, async (req, res, next) => { try {
    await archivos_service_1.ArchivosService.delete(Number(req.params.id));
    res.status(204).send();
}
catch (e) {
    next(e);
} });
exports.default = router;
