"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usuarios_service_1 = require("../services/usuarios.service");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.get('/', auth_1.authMiddleware, async (_req, res, next) => {
    try {
        const data = await usuarios_service_1.UsuariosService.list();
        res.json(data.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId })));
    }
    catch (e) {
        next(e);
    }
});
// Nuevo endpoint: obtener el usuario autenticado a partir del token
router.get('/me', auth_1.authMiddleware, async (req, res, next) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        const u = await usuarios_service_1.UsuariosService.get(req.userId);
        if (!u)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId });
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const u = await usuarios_service_1.UsuariosService.get(Number(req.params.id));
        if (!u)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId });
    }
    catch (e) {
        next(e);
    }
});
const createUserSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    rolId: zod_1.z.number().int()
});
router.post('/', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const parsed = createUserSchema.parse(req.body);
        const exists = await usuarios_service_1.UsuariosService.getByEmail?.(parsed.email);
        if (exists)
            return res.status(409).json({ error: 'Email ya existe' });
        const user = await usuarios_service_1.UsuariosService.create(parsed);
        res.status(201).json({ id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId });
    }
    catch (e) {
        next(e);
    }
});
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const user = await usuarios_service_1.UsuariosService.update(id, req.body);
        res.json({ id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/:id', auth_1.authMiddleware, (0, roles_1.requireRole)('admin'), async (req, res, next) => {
    try {
        await usuarios_service_1.UsuariosService.delete(Number(req.params.id));
        res.status(204).send();
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
