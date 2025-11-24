// Carga variables de entorno desde .env (DATABASE_URL, JWT_SECRET, etc.)
import { app } from './app';
import http from 'http';
import { createSocketServer } from './socket';
import { ensureRoles } from './ensureRoles';
import { prisma } from './prisma';
import { config, logConfigSummary } from './config';

const server = http.createServer(app);
const io = createSocketServer(server);
(global as any).io = io; // Socket.IO global broadcasting

async function seedSysadminIfNeeded() {
  const sysadminRole = await prisma.rol.findUnique({ where: { nombre: 'sysadmin' } });
  let sysadminCount = 0;
  if (sysadminRole) {
    sysadminCount = await prisma.usuario.count({ where: { rolId: sysadminRole.id } });
  }
  if (config.AUTO_SEED_ADMIN) {
    console.log('[startup] AUTO_SEED_ADMIN=true -> ejecutando seedAdmin');
    await import('./seedAdmin');
    return;
  }
  if (sysadminCount === 0) {
    console.log('[startup] No existe usuario sysadmin -> seed fallback');
    await import('./seedAdmin');
  } else {
    console.log('[startup] Sysadmin existente -> no se ejecuta seed');
  }
}

async function start() {
  console.log(`[startup] Iniciando servidor en puerto ${config.PORT}`);
  try {
    logConfigSummary();
    await ensureRoles();
    console.log('[startup] Roles verificados');
    await seedSysadminIfNeeded();
    const nullCodigoCount = await prisma.legajo.count({ where: { codigo: undefined as any } });
    if (nullCodigoCount > 0) {
      console.error(`[startup] ALERTA: Existen ${nullCodigoCount} legajos sin código tras migración. Corregir antes de operar.`);
    }
  } catch (e) {
    console.error('[startup] Error en fase inicial:', e);
  }
  server.listen(config.PORT, () => {
    console.log(`[startup] Servidor backend listo (puerto ${config.PORT})`);
  });
}

start();
