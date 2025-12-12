"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const routes_1 = require("./routes");
const errorHandler_1 = require("./middleware/errorHandler");
const prisma_1 = require("./prisma");
exports.app = (0, express_1.default)();
// CORS configuration (manual to ensure headers with Express 5)
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5000';
exports.app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    if (req.method === 'OPTIONS')
        return res.sendStatus(204);
    next();
});
exports.app.use(express_1.default.json());
// Expose Prisma client on app for routers that require it (e.g., import preview)
exports.app.set('prisma', prisma_1.prisma);
exports.app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'Backend Legajos API' });
});
// Removed Spark telemetry endpoints (/_spark/user, /_spark/loaded)
exports.app.use('/api', routes_1.router);
exports.app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});
// Central error handler (Zod + generic)
exports.app.use(errorHandler_1.errorHandler);
