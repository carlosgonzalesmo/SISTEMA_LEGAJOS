import 'dotenv/config';

interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  AUTO_SEED_ADMIN: boolean;
  ADMIN_EMAIL?: string;
  ADMIN_NAME?: string;
  ADMIN_PASSWORD?: string;
}

function requireEnv(name: string, allowDefaultDev = false, defaultValue?: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    if (allowDefaultDev && defaultValue) return defaultValue;
    throw new Error(`Variable de entorno requerida faltante: ${name}`);
  }
  return v.trim();
}

export const config: AppConfig = {
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

export function validateSeedCredentials() {
  if (!config.ADMIN_EMAIL || !config.ADMIN_NAME || !config.ADMIN_PASSWORD) {
    throw new Error('Credenciales de seed sysadmin incompletas: ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD requeridas');
  }
  if (config.ADMIN_PASSWORD.length < 6) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 6 caracteres');
  }
}

export function logConfigSummary() {
  const maskedPwd = config.ADMIN_PASSWORD ? `${'*'.repeat(Math.min(4, config.ADMIN_PASSWORD.length))} (len=${config.ADMIN_PASSWORD.length})` : 'unset';
  console.log('[config] NODE_ENV=', config.NODE_ENV);
  console.log('[config] PORT=', config.PORT);
  console.log('[config] CORS_ORIGIN=', config.CORS_ORIGIN);
  console.log('[config] AUTO_SEED_ADMIN=', config.AUTO_SEED_ADMIN);
  console.log('[config] ADMIN_EMAIL=', config.ADMIN_EMAIL || 'unset');
  console.log('[config] ADMIN_NAME=', config.ADMIN_NAME || 'unset');
  console.log('[config] ADMIN_PASSWORD=', maskedPwd);
}