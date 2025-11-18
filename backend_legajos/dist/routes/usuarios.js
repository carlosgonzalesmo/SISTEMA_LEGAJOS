"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usuarios_service_1 = require("../services/usuarios.service");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const router = (0, express_1.Router)();
router.get('/', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (_req, res, next) => {
    try {
        const data = await usuarios_service_1.UsuariosService.list({ include: { rol: true } });
        res.json(data.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId, roleName: u.rol?.nombre, activo: u.activo })));
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
        const u = await usuarios_service_1.UsuariosService.get(req.userId, { include: { rol: true } });
        if (!u)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!u.activo)
            return res.status(403).json({ error: 'Usuario deshabilitado' });
        res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId, roleName: u.rol?.nombre, activo: u.activo });
    }
    catch (e) {
        next(e);
    }
});
router.get('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const u = await usuarios_service_1.UsuariosService.get(Number(req.params.id), { include: { rol: true } });
        if (!u)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ id: u.id, nombre: u.nombre, email: u.email, rolId: u.rolId, roleName: u.rol?.nombre, activo: u.activo });
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
const updateUserSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(6).optional(),
    rolId: zod_1.z.number().int().optional()
});
router.post('/', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (req, res, next) => {
    try {
        const parsed = createUserSchema.parse(req.body);
        const exists = await usuarios_service_1.UsuariosService.getByEmail?.(parsed.email);
        if (exists)
            return res.status(409).json({ error: 'Email ya existe' });
        const hash = await bcryptjs_1.default.hash(parsed.password, 10);
        const user = await usuarios_service_1.UsuariosService.create({ ...parsed, password: hash }, { include: { rol: true } });
        const payload = { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId, roleName: user.rol?.nombre, activo: true };
        res.status(201).json(payload);
        try {
            global.io?.emit('user:created', payload);
        }
        catch { }
    }
    catch (e) {
        next(e);
    }
});
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'No autenticado' });
        const id = Number(req.params.id);
        // Obtener usuario solicitante para verificar permisos
        const requester = await usuarios_service_1.UsuariosService.get(req.userId);
        if (!requester)
            return res.status(401).json({ error: 'No autenticado' });
        const isSysadmin = requester.rol?.nombre === 'sysadmin';
        // Solo sysadmin puede modificar a otros usuarios; los demás solo a sí mismos
        if (!isSysadmin && req.userId !== id) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        // Validar payload
        const parsed = updateUserSchema.parse(req.body);
        const updateData = { ...parsed };
        // Solo sysadmin puede cambiar rolId
        if (!isSysadmin && 'rolId' in updateData) {
            delete updateData.rolId;
        }
        // Regla: no permitir quitar el último admin activo mediante cambio de rol (aplica cuando sysadmin intenta cambiarlo)
        if (isSysadmin && updateData.rolId) {
            const target = await usuarios_service_1.UsuariosService.get(id);
            if (target && target.rol?.nombre === 'admin' && updateData.rolId !== target.rolId) {
                const all = await usuarios_service_1.UsuariosService.list();
                const remainingActiveAdmins = all.filter((u) => u.rolId === target.rolId && u.activo !== false && u.id !== id).length;
                if (remainingActiveAdmins === 0) {
                    return res.status(400).json({ error: 'No puedes quitar el último administrador activo' });
                }
            }
        }
        // Hash de contraseña si viene nueva
        if (updateData.password) {
            updateData.password = await bcryptjs_1.default.hash(updateData.password, 10);
        }
        // Evitar colisión de email
        if (updateData.email) {
            const existing = await usuarios_service_1.UsuariosService.getByEmail(updateData.email);
            if (existing && existing.id !== id) {
                return res.status(409).json({ error: 'Email ya existe' });
            }
        }
        const user = await usuarios_service_1.UsuariosService.update(id, updateData, { include: { rol: true } });
        const payload = { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId, roleName: user.rol?.nombre, activo: user.activo };
        res.json(payload);
        try {
            global.io?.emit('user:updated', payload);
        }
        catch { }
    }
    catch (e) {
        next(e);
    }
});
router.delete('/:id', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (req, res, next) => {
    try {
        await usuarios_service_1.UsuariosService.delete(Number(req.params.id));
        res.status(204).send();
    }
    catch (e) {
        next(e);
    }
});
// Deshabilitar usuario (soft delete) - solo admin y no puede deshabilitarse a sí mismo
router.post('/:id/disable', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (req.userId === id)
            return res.status(400).json({ error: 'No puedes deshabilitar tu propio usuario' });
        const updated = await usuarios_service_1.UsuariosService.update(id, { activo: false }, { include: { rol: true } });
        const payload = { id: updated.id, nombre: updated.nombre, email: updated.email, rolId: updated.rolId, roleName: updated.rol?.nombre, activo: updated.activo };
        res.json(payload);
        try {
            global.io?.emit('user:updated', payload);
        }
        catch { }
    }
    catch (e) {
        next(e);
    }
});
// Habilitar usuario - solo admin
router.post('/:id/enable', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (_req, res, next) => {
    try {
        const id = Number(_req.params.id);
        const updated = await usuarios_service_1.UsuariosService.update(id, { activo: true }, { include: { rol: true } });
        const payload = { id: updated.id, nombre: updated.nombre, email: updated.email, rolId: updated.rolId, roleName: updated.rol?.nombre, activo: updated.activo };
        res.json(payload);
        try {
            global.io?.emit('user:updated', payload);
        }
        catch { }
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
// Purge masivo de usuarios (excepto el propio sysadmin por defecto)
// Advertencia: Esta operación es destructiva. Se puede pasar { includeSelf: true } para eliminar también
// al usuario autenticado, lo cual dejaría el sistema sin usuarios hasta re-seed.
router.post('/purge', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (req, res, next) => {
    try {
        const includeSelf = !!req.body?.includeSelf;
        const targetUsers = await prisma_1.prisma.usuario.findMany({ where: includeSelf ? {} : { NOT: { id: req.userId } } });
        if (targetUsers.length === 0)
            return res.json({ deleted: 0, includeSelf });
        const ids = targetUsers.map(u => u.id);
        await prisma_1.prisma.$transaction([
            // Eliminar workflow relacionado primero (solicitudes, devoluciones, prestamos) y sus tablas puente
            prisma_1.prisma.solicitudLegajo.deleteMany({ where: { solicitud: { usuarioId: { in: ids } } } }),
            prisma_1.prisma.devolucionLegajo.deleteMany({ where: { devolucion: { usuarioId: { in: ids } } } }),
            prisma_1.prisma.prestamo.deleteMany({ where: { usuarioId: { in: ids } } }),
            prisma_1.prisma.solicitud.deleteMany({ where: { usuarioId: { in: ids } } }),
            prisma_1.prisma.devolucion.deleteMany({ where: { usuarioId: { in: ids } } }),
            // Historial de titulares asociado a legajos de los usuarios O donde el usuario figura como titular histórico
            prisma_1.prisma.legajoHolderHistory.deleteMany({ where: { OR: [{ usuarioId: { in: ids } }, { legajo: { usuarioId: { in: ids } } }] } }),
            // Archivos asociados a legajos de los usuarios a eliminar
            prisma_1.prisma.archivo.deleteMany({ where: { legajo: { usuarioId: { in: ids } } } }),
            // Legajos de los usuarios
            prisma_1.prisma.legajo.deleteMany({ where: { usuarioId: { in: ids } } }),
            // Finalmente los usuarios
            prisma_1.prisma.usuario.deleteMany({ where: { id: { in: ids } } })
        ]);
        res.json({ deleted: ids.length, includeSelf });
    }
    catch (e) {
        next(e);
    }
});
