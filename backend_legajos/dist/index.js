"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Carga variables de entorno desde .env (DATABASE_URL, JWT_SECRET, etc.)
require("dotenv/config");
const app_1 = require("./app");
const ensureRoles_1 = require("./ensureRoles");
const prisma_1 = require("./prisma");
const PORT = process.env.PORT || 3001;
app_1.app.listen(PORT, async () => {
    console.log(`Servidor backend escuchando en puerto ${PORT}`);
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
