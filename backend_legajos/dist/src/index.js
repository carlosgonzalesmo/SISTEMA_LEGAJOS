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
        const autoSeedFlag = process.env.AUTO_SEED_ADMIN;
        console.log(`AUTO_SEED_ADMIN valor='${autoSeedFlag}'`);
        // Comprobar existencia de sysadmin antes de decidir el seed.
        const sysadminRole = await prisma_1.prisma.rol.findUnique({ where: { nombre: 'sysadmin' } });
        let sysadminCount = 0;
        if (sysadminRole) {
            sysadminCount = await prisma_1.prisma.usuario.count({ where: { rolId: sysadminRole.id } });
        }
        console.log(`Usuarios sysadmin existentes: ${sysadminCount}`);
        // Si se activa la bandera AUTO_SEED_ADMIN, importar dinámicamente el script de seed.
        // El archivo seedAdmin.ts ejecuta main() al ser importado, recreando/actualizando el usuario sysadmin.
        if (process.env.AUTO_SEED_ADMIN === 'true') {
            console.log('AUTO_SEED_ADMIN=true detectado. Ejecutando seedAdmin...');
            // Log detalle de credenciales usadas (solo correo y nombre; nunca la contraseña completa en producción)
            const adminEmail = process.env.ADMIN_EMAIL || 'sysadmin@test.com';
            const adminName = process.env.ADMIN_NAME || 'SysAdmin';
            const adminPassPresent = !!process.env.ADMIN_PASSWORD;
            console.log(`Seed sysadmin -> email=${adminEmail} nombre=${adminName} password_definida=${adminPassPresent}`);
            try {
                await Promise.resolve().then(() => __importStar(require('./seedAdmin')));
                console.log('Seed admin/sysadmin completado (o actualizado).');
            }
            catch (seedErr) {
                console.error('Error ejecutando seedAdmin:', seedErr);
            }
        }
        else {
            if (sysadminCount === 0) {
                console.log('No existe ningún usuario sysadmin. Ejecutando seedAdmin por fallback (sin bandera).');
                const adminEmail = process.env.ADMIN_EMAIL || 'sysadmin@test.com';
                const adminName = process.env.ADMIN_NAME || 'SysAdmin';
                const adminPassPresent = !!process.env.ADMIN_PASSWORD;
                console.log(`Fallback seed sysadmin -> email=${adminEmail} nombre=${adminName} password_definida=${adminPassPresent}`);
                try {
                    await Promise.resolve().then(() => __importStar(require('./seedAdmin')));
                    console.log('Fallback seed sysadmin completado.');
                }
                catch (seedErr) {
                    console.error('Error en fallback seedAdmin:', seedErr);
                }
            }
            else {
                console.log('AUTO_SEED_ADMIN no habilitado y ya existe sysadmin; no se ejecuta seed.');
            }
        }
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
