// Carga variables de entorno desde .env (DATABASE_URL, JWT_SECRET, etc.)
import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
	console.log(`Servidor backend escuchando en puerto ${PORT}`);
	if (!process.env.DATABASE_URL) {
		console.warn('ADVERTENCIA: DATABASE_URL no está definido. Asegúrate de tener .env cargado.');
	}
});
