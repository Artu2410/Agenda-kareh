#!/usr/bin/env node

/**
 * Script de Validación - Email OTP Configuration Checker
 * Uso: node validate-otp-config.js
 * 
 * Verifica que todas las credenciales necesarias estén configuradas correctamente
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

console.log('\n🔍 Validador de Configuración Email OTP\n');
console.log('═'.repeat(50));

// Leer el archivo .env
const envPath = path.resolve(process.cwd(), 'server', '.env');

if (!fs.existsSync(envPath)) {
  console.error(`\n❌ CRÍTICO: No se encuentra el archivo .env en: ${envPath}\n`);
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));

let errors = [];
let warnings = [];
let success = [];

// ========== VALIDACIONES ==========

// 1. GMAIL_USER
if (!envConfig.GMAIL_USER) {
  errors.push('❌ GMAIL_USER no está configurado');
} else if (envConfig.GMAIL_USER === 'centrokareh@gmail.com') {
  success.push(`✅ GMAIL_USER: ${envConfig.GMAIL_USER}`);
} else {
  warnings.push(`⚠️  GMAIL_USER: ${envConfig.GMAIL_USER} (esperado: centrokareh@gmail.com)`);
}

// 2. GMAIL_APP_PASSWORD
if (!envConfig.GMAIL_APP_PASSWORD) {
  errors.push('❌ GMAIL_APP_PASSWORD no está configurado');
} else if (envConfig.GMAIL_APP_PASSWORD.includes('tu_contraseña')) {
  errors.push('❌ GMAIL_APP_PASSWORD sigue siendo un placeholder. Debes reemplazarlo con la contraseña real de Google.');
} else if (envConfig.GMAIL_APP_PASSWORD.length < 14) {
  errors.push(`❌ GMAIL_APP_PASSWORD parece muy corta (${envConfig.GMAIL_APP_PASSWORD.length} chars, esperados 16)`);
} else {
  success.push(`✅ GMAIL_APP_PASSWORD: Configurada (${envConfig.GMAIL_APP_PASSWORD.length} caracteres)`);
}

// 3. JWT_SECRET
if (!envConfig.JWT_SECRET) {
  errors.push('❌ JWT_SECRET no está configurado');
} else if (envConfig.JWT_SECRET.includes('tu_jwt_secret')) {
  errors.push('❌ JWT_SECRET sigue siendo un placeholder. Debes reemplazarlo.'); } else if (envConfig.JWT_SECRET.length < 32) {
  errors.push(`❌ JWT_SECRET muy corto (${envConfig.JWT_SECRET.length} chars, mínimo 32)`);
} else {
  success.push(`✅ JWT_SECRET: Configurado (${envConfig.JWT_SECRET.length} caracteres)`);
}

// 4. AUTHORIZED_EMAIL
if (!envConfig.AUTHORIZED_EMAIL) {
  warnings.push('⚠️  AUTHORIZED_EMAIL no está configurado (usando default: centrokareh@gmail.com)');
} else {
  success.push(`✅ AUTHORIZED_EMAIL: ${envConfig.AUTHORIZED_EMAIL}`);
}

// 5. DATABASE_URL
if (!envConfig.DATABASE_URL) {
  warnings.push('⚠️  DATABASE_URL no está configurado');
} else {
  success.push('✅ DATABASE_URL: Configurada');
}

// 6. PORT
if (!envConfig.PORT) {
  warnings.push('⚠️  PORT no está configurado (usando default: 5000)');
} else {
  success.push(`✅ PORT: ${envConfig.PORT}`);
}

// 7. NODE_ENV
if (!envConfig.NODE_ENV) {
  warnings.push('⚠️  NODE_ENV no está configurado (usando default: development)');
} else {
  success.push(`✅ NODE_ENV: ${envConfig.NODE_ENV}`);
}

// ========== SALIDA ==========

console.log('\n✅ VÁLIDO:\n');
success.forEach(msg => console.log(`  ${msg}`));

if (warnings.length > 0) {
  console.log('\n⚠️  ADVERTENCIAS:\n');
  warnings.forEach(msg => console.log(`  ${msg}`));
}

if (errors.length > 0) {
  console.log('\n❌ ERRORES - DEBES CORREGIR:\n');
  errors.forEach(msg => console.log(`  ${msg}`));
  
  console.log('\n📋 SOLUCIÓN RÁPIDA:');
  console.log('─'.repeat(50));
  console.log('\n1. Ve a: https://myaccount.google.com/security');
  console.log('2. Busca: "Contraseñas de aplicaciones"');
  console.log('3. Selecciona: Mail + tu dispositivo');
  console.log('4. Copia la contraseña de 16 caracteres');
  console.log('5. En server/.env, reemplaza GMAIL_APP_PASSWORD con esa contraseña');
  console.log('\n6. Para JWT_SECRET, ejecuta en PowerShell:');
  console.log('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.log('7. Copia el resultado a JWT_SECRET en .env');
  console.log('\n8. Reinicia el servidor: node server.js\n');
  
  process.exit(1);
}

console.log('\n' + '═'.repeat(50));
console.log('🎉 CONFIGURACIÓN VÁLIDA - Sistema listo para usar\n');
console.log('Próximos pasos:');
console.log('1. Reinicia el servidor: node server.js');
console.log('2. Abre el frontend: http://localhost:5173');
console.log('3. Intenta hacer login con centrokareh@gmail.com');
console.log('4. Deberías recibir un email en 30 segundos\n');

process.exit(0);
