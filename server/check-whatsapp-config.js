#!/usr/bin/env node

// Script para verificar configuración de WhatsApp
console.log('🔍 Verificando configuración de WhatsApp...\n');

const requiredEnvVars = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_TICKET_TEMPLATE'
];

const optionalEnvVars = [
  'WHATSAPP_API_VERSION',
  'WHATSAPP_TEMPLATE_LANGUAGE'
];

console.log('📋 Variables requeridas:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅ Configurada' : '❌ Faltante';
  console.log(`  ${varName}: ${status}`);
  if (value) {
    console.log(`    Valor: ${value.substring(0, 20)}...`);
  }
});

console.log('\n📋 Variables opcionales:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName] || '(usando valor por defecto)';
  console.log(`  ${varName}: ${value}`);
});

console.log('\n🔗 Endpoint de diagnóstico: GET /api/appointments/whatsapp-diagnostic');

const missing = requiredEnvVars.filter(varName => !process.env[varName]);
if (missing.length > 0) {
  console.log('\n❌ Variables faltantes que deben configurarse:');
  missing.forEach(varName => console.log(`  - ${varName}`));
  console.log('\n💡 Revisa tu configuración en Render o archivo .env');
} else {
  console.log('\n✅ Todas las variables requeridas están configuradas');
}</content>
<parameter name="filePath">d:\kareh-pro\server\check-whatsapp-config.js