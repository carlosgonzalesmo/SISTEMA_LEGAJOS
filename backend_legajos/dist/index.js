"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Carga variables de entorno desde .env (DATABASE_URL, JWT_SECRET, etc.)
const app_1 = require("./app");
const http_1 = __importDefault(require("http"));
const socket_1 = require("./socket");
const ensureRoles_1 = require("./ensureRoles");
const prisma_1 = require("./prisma");
const config_1 = require("./config");
const server = http_1.default.createServer(app_1.app);
const io = (0, socket_1.createSocketServer)(server);
global.io = io; // Socket.IO global broadcasting
async function seedSysadminIfNeeded() {
    const sysadminRole = await prisma_1.prisma.rol.findUnique({ where: { nombre: 'sysadmin' } });
    let sysadminCount = 0;
    if (sysadminRole) {
        sysadminCount = await prisma_1.prisma.usuario.count({ where: { rolId: sysadminRole.id } });
    }
    if (config_1.config.AUTO_SEED_ADMIN) {
        console.log('[startup] AUTO_SEED_ADMIN=true -> ejecutando seedAdmin');
        await Promise.resolve().then(() => __importStar(require('./seedAdmin')));
        return;
    }
    if (sysadminCount === 0) {
        console.log('[startup] No existe usuario sysadmin -> seed fallback');
        await Promise.resolve().then(() => __importStar(require('./seedAdmin')));
    }
    else {
        console.log('[startup] Sysadmin existente -> no se ejecuta seed');
    }
}
async function start() {
    console.log(`[startup] Iniciando servidor en puerto ${config_1.config.PORT}`);
    try {
        (0, config_1.logConfigSummary)();
        await (0, ensureRoles_1.ensureRoles)();
        console.log('[startup] Roles verificados');
        await seedSysadminIfNeeded();
        const nullCodigoCount = await prisma_1.prisma.legajo.count({ where: { codigo: undefined } });
        if (nullCodigoCount > 0) {
            console.error(`[startup] ALERTA: Existen ${nullCodigoCount} legajos sin código tras migración. Corregir antes de operar.`);
        }
    }
    catch (e) {
        console.error('[startup] Error en fase inicial:', e);
    }
    server.listen(config_1.config.PORT, () => {
        console.log(`[startup] Servidor backend listo (puerto ${config_1.config.PORT})`);
    });
}
start();
