"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const signupSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    rolId: zod_1.z.number().int()
});
router.post('/signup', async (req, res, next) => {
    try {
        const parsed = signupSchema.parse(req.body);
        const exists = await prisma_1.prisma.usuario.findUnique({ where: { email: parsed.email } });
        if (exists)
            return res.status(409).json({ error: 'Email ya registrado' });
        const hash = await bcryptjs_1.default.hash(parsed.password, 10);
        const user = await prisma_1.prisma.usuario.create({ data: { ...parsed, password: hash } });
        const token = (0, auth_1.signToken)(user.id);
        res.status(201).json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId } });
    }
    catch (e) {
        next(e);
    }
});
const loginSchema = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(6) });
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.usuario.findUnique({ where: { email } });
        if (!user)
            return res.status(401).json({ error: 'Credenciales inválidas' });
        const ok = await bcryptjs_1.default.compare(password, user.password);
        if (!ok)
            return res.status(401).json({ error: 'Credenciales inválidas' });
        const token = (0, auth_1.signToken)(user.id);
        res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rolId: user.rolId } });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
