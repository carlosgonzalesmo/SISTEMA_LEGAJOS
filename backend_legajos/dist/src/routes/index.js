"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const usuarios_1 = __importDefault(require("./usuarios"));
const roles_1 = __importDefault(require("./roles"));
const legajos_1 = __importDefault(require("./legajos"));
const archivos_1 = __importDefault(require("./archivos"));
const auth_1 = __importDefault(require("./auth"));
const workflow_1 = __importDefault(require("./workflow"));
const settings_1 = __importDefault(require("./settings"));
// New grouped routers (architectural separation)
const admin_1 = __importDefault(require("./admin"));
const sysadmin_1 = __importDefault(require("./sysadmin"));
exports.router = (0, express_1.Router)();
// Legacy mounts (kept for backward compatibility / existing frontend calls)
exports.router.use('/usuarios', usuarios_1.default);
exports.router.use('/roles', roles_1.default);
exports.router.use('/legajos', legajos_1.default);
exports.router.use('/archivos', archivos_1.default);
exports.router.use('/auth', auth_1.default);
exports.router.use('/workflow', workflow_1.default);
exports.router.use('/settings', settings_1.default);
// New hierarchical architecture (phase 1):
// /admin -> operational domain (legajos CRUD, archivos, workflow lifecycle)
// /sysadmin -> governance domain (usuarios, roles, system settings)
// NOTE: We intentionally DO NOT gate /admin with admin-only to preserve user access
// to workflow creation endpoints. Existing per-route guards (denySysadmin, requireRole('admin')) remain.
exports.router.use('/admin', admin_1.default);
exports.router.use('/sysadmin', sysadmin_1.default);
