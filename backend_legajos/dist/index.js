"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Carga variables de entorno desde .env (DATABASE_URL, JWT_SECRET, etc.)
require("dotenv/config");
const app_1 = require("./app");
const ensureRoles_1 = require("./ensureRoles");
const prisma_1 = require("./prisma");
const http_1 = __importDefault(require("http"));
const socket_1 = require("./socket");
const PORT = process.env.PORT || 3001;
const server = http_1.default.createServer(app_1.app);
const io = (0, socket_1.createSocketServer)(server);
// Exponer instancia global para emisiones desde rutas (legajos, workflow, usuarios)
global.io = io;
server.listen(PORT, async () => {
    console.log(`Servidor backend + Socket.IO escuchando en puerto ${PORT}`);
    if (!process.env.DATABASE_URL) {
        console.warn('ADVERTENCIA: DATABASE_URL no está definido. Asegúrate de tener .env cargado.');
    }
    try {
        await (0, ensureRoles_1.ensureRoles)();
        console.log('Roles verificados/creados');
        // Validar que no existan legajos sin código (post-migración requerida)
        const nullCodigoCount = await prisma_1.prisma.legajo.count({ where: { codigo: undefined } });
        if (nullCodigoCount > 0) {
            console.error(`ERROR: Existen ${nullCodigoCount} legajos sin código tras migración requerida. Complete los códigos antes de continuar.`);
        }
    }
    catch (e) {
        console.error('Error asegurando roles base:', e);
    }
});
