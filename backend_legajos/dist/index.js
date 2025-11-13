"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Carga variables de entorno desde .env (DATABASE_URL, JWT_SECRET, etc.)
require("dotenv/config");
const app_1 = require("./app");
const PORT = process.env.PORT || 3001;
app_1.app.listen(PORT, () => {
    console.log(`Servidor backend escuchando en puerto ${PORT}`);
    if (!process.env.DATABASE_URL) {
        console.warn('ADVERTENCIA: DATABASE_URL no está definido. Asegúrate de tener .env cargado.');
    }
});
