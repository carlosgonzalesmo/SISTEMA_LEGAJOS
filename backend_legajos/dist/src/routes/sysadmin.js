"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usuarios_1 = __importDefault(require("./usuarios"));
const roles_1 = __importDefault(require("./roles"));
const settings_1 = __importDefault(require("./settings"));
const auth_1 = require("../middleware/auth");
const roles_2 = require("../middleware/roles");
// Agrupa rutas de gobernanza (gestión de usuarios, roles y configuración del sistema).
// Se aplica un guard global sysadmin; así, /sysadmin/* queda reservado.
// NOTA: Las rutas legacy (/usuarios, /roles, /settings) permanecen montadas para compatibilidad y
// para permitir lectura de settings por otros roles mientras se migra el frontend.
const sysadminRouter = (0, express_1.Router)();
sysadminRouter.use(auth_1.authMiddleware, (0, roles_2.requireRole)('sysadmin'));
sysadminRouter.use('/usuarios', usuarios_1.default);
sysadminRouter.use('/roles', roles_1.default);
sysadminRouter.use('/settings', settings_1.default);
exports.default = sysadminRouter;
