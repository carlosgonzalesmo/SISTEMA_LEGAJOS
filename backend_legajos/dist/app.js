"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const routes_1 = require("./routes");
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
exports.app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'Backend Legajos API' });
});
// Spark runtime compatibility stubs
exports.app.get('/_spark/user', (_req, res) => {
    // Return minimal anonymous user info; frontend will ignore if not needed
    res.json({ anonymous: true });
});
exports.app.post('/_spark/loaded', (req, res) => {
    // Accept telemetry payload silently
    res.status(200).json({ ok: true });
});
exports.app.use('/api', routes_1.router);
exports.app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});
exports.app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});
