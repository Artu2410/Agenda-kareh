#!/usr/bin/env node

import 'dotenv/config';

const requiredEnvVars = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
];

const optionalEnvVars = [
  'WHATSAPP_API_VERSION',
  'WHATSAPP_TEMPLATE_LANGUAGE',
  'WHATSAPP_TICKET_TEMPLATE',
  'WHATSAPP_REMINDER_TEMPLATE',
  'WHATSAPP_CRON_TOKEN',
];

const looksLikePlaceholder = (value = '') => /^(tu_|your_|nombre_|token_|xxxx|example)/i.test(String(value).trim());

const maskValue = (value = '') => {
  const normalized = String(value).trim();
  if (!normalized) return '(vacío)';
  if (normalized.length <= 8) return '********';
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
};

const warnings = [];

console.log('\nVerificación de configuración WhatsApp\n');

console.log('Requeridas:');
requiredEnvVars.forEach((name) => {
  const value = process.env[name];
  console.log(`- ${name}: ${value ? maskValue(value) : 'faltante'}`);
  if (value && looksLikePlaceholder(value)) {
    warnings.push(`${name} parece seguir con un valor de ejemplo`);
  }
});

console.log('\nOpcionales:');
optionalEnvVars.forEach((name) => {
  const value = process.env[name];
  console.log(`- ${name}: ${value ? maskValue(value) : 'sin configurar'}`);
  if (value && looksLikePlaceholder(value)) {
    warnings.push(`${name} parece seguir con un valor de ejemplo`);
  }
});

const missing = requiredEnvVars.filter((name) => !String(process.env[name] || '').trim());

if (missing.length > 0) {
  console.log('\nFaltan variables obligatorias:');
  missing.forEach((name) => console.log(`- ${name}`));
  console.log('');
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('\nAdvertencias:');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

console.log('\nConfiguración de WhatsApp válida.\n');
