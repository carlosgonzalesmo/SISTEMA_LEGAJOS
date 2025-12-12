"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const logger_1 = require("../lib/logger");
// Central error handling middleware to reduce repetitive try/catch responses.
// Attach at the end of the middleware chain in app.ts
function errorHandler(err, _req, res, _next) {
    // Zod validation errors
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos' });
    }
    // Known shape with status
    if (err && typeof err.status === 'number') {
        return res.status(err.status).json({ error: err.message || 'Error' });
    }
    (0, logger_1.error)('Unhandled error', err);
    return res.status(500).json({ error: 'Error interno' });
}
