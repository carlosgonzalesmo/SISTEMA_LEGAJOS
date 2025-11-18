"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roles_service_1 = require("../services/roles.service");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const router = (0, express_1.Router)();
router.get('/', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (_req, res, next) => { try {
    res.json(await roles_service_1.RolesService.list());
}
catch (e) {
    next(e);
} });
router.post('/', auth_1.authMiddleware, (0, roles_1.requireRole)('sysadmin'), async (req, res, next) => { try {
    res.status(201).json(await roles_service_1.RolesService.create({ nombre: req.body.nombre }));
}
catch (e) {
    next(e);
} });
exports.default = router;
