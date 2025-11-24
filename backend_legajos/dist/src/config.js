"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateSeedCredentials = validateSeedCredentials;
exports.logConfigSummary = logConfigSummary;
require("dotenv/config");
function requireEnv(name, allowDefaultDev = false, defaultValue) {
    const v = process.env[name];
    if (!v || v.trim() === '') {
        if (allowDefaultDev && defaultValue)
            return defaultValue;
        throw new Error(`Variable de entorno requerida faltante: ${name}`);
    }
    return v.trim();
}
exports.config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    DATABASE_URL: requireEnv('DATABASE_URL', false),
    JWT_SECRET: requireEnv('JWT_SECRET', false),
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5000',
    AUTO_SEED_ADMIN: process.env.AUTO_SEED_ADMIN === 'true',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_NAME: process.env.ADMIN_NAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
};
function validateSeedCredentials() {
    if (!exports.config.ADMIN_EMAIL || !exports.config.ADMIN_NAME || !exports.config.ADMIN_PASSWORD) {
        throw new Error('Credenciales de seed sysadmin incompletas: ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD requeridas');
    }
    if (exports.config.ADMIN_PASSWORD.length < 6) {
        throw new Error('ADMIN_PASSWORD debe tener al menos 6 caracteres');
    }
}
function logConfigSummary() {
    const maskedPwd = exports.config.ADMIN_PASSWORD ? `${'*'.repeat(Math.min(4, exports.config.ADMIN_PASSWORD.length))} (len=${exports.config.ADMIN_PASSWORD.length})` : 'unset';
    console.log('[config] NODE_ENV=', exports.config.NODE_ENV);
    console.log('[config] PORT=', exports.config.PORT);
    console.log('[config] CORS_ORIGIN=', exports.config.CORS_ORIGIN);
    console.log('[config] AUTO_SEED_ADMIN=', exports.config.AUTO_SEED_ADMIN);
    console.log('[config] ADMIN_EMAIL=', exports.config.ADMIN_EMAIL || 'unset');
    console.log('[config] ADMIN_NAME=', exports.config.ADMIN_NAME || 'unset');
    console.log('[config] ADMIN_PASSWORD=', maskedPwd);
}
