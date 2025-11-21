// Carga variables de entorno desde .env (DATABASE_URL, JWT_SECRET, etc.)
import 'dotenv/config';
import { app } from './app';
import { ensureRoles } from './ensureRoles';
import { prisma } from './prisma';
import http from 'http';
import { createSocketServer } from './socket';

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const io = createSocketServer(server);
// Exponer instancia global para emisiones desde rutas (legajos, workflow, usuarios)
(global as any).io = io;

server.listen(PORT, async () => {
	console.log(`Servidor backend + Socket.IO escuchando en puerto ${PORT}`);
	if (!process.env.DATABASE_URL) {
		console.warn('ADVERTENCIA: DATABASE_URL no está definido. Asegúrate de tener .env cargado.');
	}
	try {
		await ensureRoles();
		console.log('Roles verificados/creados');
		// Si se activa la bandera AUTO_SEED_ADMIN, importar dinámicamente el script de seed.
		// El archivo seedAdmin.ts ejecuta main() al ser importado, recreando/actualizando el usuario sysadmin.
		if (process.env.AUTO_SEED_ADMIN === 'true') {
			console.log('AUTO_SEED_ADMIN=true detectado. Ejecutando seedAdmin...');
			try {
				await import('./seedAdmin');
				console.log('Seed admin/sysadmin completado (o actualizado).');
			} catch (seedErr) {
				console.error('Error ejecutando seedAdmin:', seedErr);
			}
		} else {
			console.log('AUTO_SEED_ADMIN no habilitado; omitiendo recreación automática de usuario sysadmin.');
		}
		// Validar que no existan legajos sin código (post-migración requerida)
		const nullCodigoCount = await prisma.legajo.count({ where: { codigo: undefined as any } });
		if (nullCodigoCount > 0) {
			console.error(`ERROR: Existen ${nullCodigoCount} legajos sin código tras migración requerida. Complete los códigos antes de continuar.`);
		}
	} catch (e) {
		console.error('Error asegurando roles base:', e);
	}
});
