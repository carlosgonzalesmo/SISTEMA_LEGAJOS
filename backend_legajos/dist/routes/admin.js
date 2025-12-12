"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const legajos_1 = __importDefault(require("./legajos"));
const archivos_1 = __importDefault(require("./archivos"));
const workflow_1 = __importDefault(require("./workflow"));
const import_1 = require("./import");
// Agrupa rutas operativas (dominio "operacional")
// Se mantiene sin middleware de rol global para que usuarios (role=user) puedan
// seguir creando solicitudes y devoluciones vía /admin/workflow/*.
// Las restricciones específicas permanecen dentro de cada sub‑router:
//  - denySysadmin en legajos/workflow evita acceso de sysadmin.
//  - requireRole('admin') en acciones administrativas puntuales.
const adminRouter = (0, express_1.Router)();
adminRouter.use('/legajos', legajos_1.default);
adminRouter.use('/archivos', archivos_1.default);
adminRouter.use('/workflow', workflow_1.default);
adminRouter.use('/import', import_1.importRouter);
exports.default = adminRouter;
