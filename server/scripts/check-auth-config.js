#!/usr/bin/env node

import 'dotenv/config';
import { getBootstrapUsers, getJwtSecret, getRefreshSecret, parseDurationToMs } from '../src/utils/auth.js';

const issues = [];
const warnings = [];
const notes = [];

const requireEnv = (name, { minLength = 0, allowPlaceholder = false } = {}) => {
  const value = String(process.env[name] || '').trim();

  if (!value) {
    issues.push(`${name}: faltante`);
    return '';
  }

  if (!allowPlaceholder && /^tu_|^your_|placeholder/i.test(value)) {
    issues.push(`${name}: sigue con un placeholder`);
    return value;
  }

  if (minLength > 0 && value.length < minLength) {
    issues.push(`${name}: demasiado corto (${value.length}, mínimo ${minLength})`);
  }

  return value;
};

const warnIfMissing = (name, message) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    warnings.push(message || `${name}: faltante`);
    return '';
  }
  return value;
};

try {
  requireEnv('JWT_SECRET', { minLength: 32 });
  requireEnv('REFRESH_TOKEN_SECRET', { minLength: 32 });
  requireEnv('DATABASE_URL', { minLength: 10 });

  const accessTtl = parseDurationToMs(process.env.JWT_EXPIRES_IN || '15m', 15 * 60 * 1000);
  const refreshTtl = parseDurationToMs(process.env.REFRESH_TOKEN_EXPIRES_IN || '30d', 30 * 24 * 60 * 60 * 1000);

  if (refreshTtl <= accessTtl) {
    issues.push('REFRESH_TOKEN_EXPIRES_IN debe ser mayor que JWT_EXPIRES_IN');
  }

  const bootstrapUsers = getBootstrapUsers();
  if (bootstrapUsers.length === 0) {
    issues.push('No hay usuarios bootstrap configurados (AUTHORIZED_EMAIL o AUTH_BOOTSTRAP_USERS)');
  } else {
    notes.push(`Usuarios bootstrap: ${bootstrapUsers.map((user) => `${user.email} (${user.role})`).join(', ')}`);
  }

  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (process.env.NODE_ENV === 'production' && !resendApiKey) {
    issues.push('RESEND_API_KEY es obligatoria en producción');
  } else if (!resendApiKey) {
    warnings.push('RESEND_API_KEY no configurada. El OTP solo funcionará en modo desarrollo.');
  }

  warnIfMissing('AUTH_HASH_PEPPER', 'AUTH_HASH_PEPPER no configurada. Se usará JWT_SECRET como fallback.');
  warnIfMissing('OTP_PEPPER', 'OTP_PEPPER no configurada. Se usará AUTH_HASH_PEPPER/JWT_SECRET como fallback.');

  getJwtSecret();
  getRefreshSecret();
} catch (error) {
  issues.push(error.message);
}

console.log('\nVerificación de autenticación Kareh\n');

if (notes.length > 0) {
  console.log('Resumen:');
  notes.forEach((note) => console.log(`- ${note}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('Advertencias:');
  warnings.forEach((warning) => console.log(`- ${warning}`));
  console.log('');
}

if (issues.length > 0) {
  console.log('Errores:');
  issues.forEach((issue) => console.log(`- ${issue}`));
  console.log('');
  process.exit(1);
}

console.log('Configuración de autenticación válida.\n');
