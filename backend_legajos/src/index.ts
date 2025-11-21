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
		const autoSeedFlag = process.env.AUTO_SEED_ADMIN;
		console.log(`AUTO_SEED_ADMIN valor='${autoSeedFlag}'`);
		// Comprobar existencia de sysadmin antes de decidir el seed.
		const sysadminRole = await prisma.rol.findUnique({ where: { nombre: 'sysadmin' } });
		let sysadminCount = 0;
		if (sysadminRole) {
			sysadminCount = await prisma.usuario.count({ where: { rolId: sysadminRole.id } });
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
				await import('./seedAdmin');
				console.log('Seed admin/sysadmin completado (o actualizado).');
			} catch (seedErr) {
				console.error('Error ejecutando seedAdmin:', seedErr);
			}
		} else {
			if (sysadminCount === 0) {
				console.log('No existe ningún usuario sysadmin. Ejecutando seedAdmin por fallback (sin bandera).');
				const adminEmail = process.env.ADMIN_EMAIL || 'sysadmin@test.com';
				const adminName = process.env.ADMIN_NAME || 'SysAdmin';
				const adminPassPresent = !!process.env.ADMIN_PASSWORD;
				console.log(`Fallback seed sysadmin -> email=${adminEmail} nombre=${adminName} password_definida=${adminPassPresent}`);
				try {
					await import('./seedAdmin');
					console.log('Fallback seed sysadmin completado.');
				} catch (seedErr) {
					console.error('Error en fallback seedAdmin:', seedErr);
				}
			} else {
				console.log('AUTO_SEED_ADMIN no habilitado y ya existe sysadmin; no se ejecuta seed.');
			}
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
