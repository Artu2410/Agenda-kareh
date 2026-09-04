#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getUploadsDir } from '../src/services/storage.js';

const prisma = new PrismaClient();
const LOCAL_UPLOAD_PREFIX = '/uploads/';
const AWS_HOST_PATTERN = /(?:^|\.)amazonaws\.com$/i;
const BUCKET_NAME = 'kareh-uploads';

const URL_FIELDS = {
  patient: ['dniImageUrl', 'dniBackImageUrl', 'insuranceCardImageUrl', 'insuranceCardBackImageUrl', 'cudCredentialUrl'],
  professional: [
    'dniImageUrl',
    'dniBackImageUrl',
    'licenseMNImageUrl',
    'licenseMNBackImageUrl',
    'licenseMPImageUrl',
    'licenseMPBackImageUrl',
    'degreeImageUrl',
    'degreeBackImageUrl',
    'providerRegistryImageUrl',
    'malpracticeInsuranceImageUrl',
  ],
};

const parseS3Key = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const rawPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
  const decodedPath = decodeURIComponent(rawPath);
  const hostParts = parsed.hostname.split('.');
  const bucketInHost = hostParts[0] === BUCKET_NAME || hostParts[0].startsWith(`${BUCKET_NAME}-`);
  const bucketIndex = decodedPath.split('/').indexOf(BUCKET_NAME);
  const isKnownStorageUrl = AWS_HOST_PATTERN.test(parsed.hostname)
    || bucketInHost
    || bucketIndex >= 0;
  if (!isKnownStorageUrl) return null;
  const key = bucketInHost
    ? rawPath
    : (bucketIndex >= 0 ? rawPath.split('/').slice(bucketIndex + 1).join('/') : null);

  if (!key || decodeURIComponent(key).includes('..') || key.startsWith('/')) return null;
  return key;
};

export const migrateStoredFileUrl = (value) => {
  const key = parseS3Key(value);
  return key ? `${LOCAL_UPLOAD_PREFIX}${key}` : null;
};

export const migrateAttachmentsJson = (value) => {
  if (!value) return { value, changed: false };

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { value, changed: false };
  }

  let changed = false;
  const visit = (item) => {
    if (Array.isArray(item)) return item.map(visit);
    if (!item || typeof item !== 'object') return item;

    return Object.fromEntries(Object.entries(item).map(([key, child]) => {
      if (typeof child === 'string') {
        const migrated = migrateStoredFileUrl(child);
        if (migrated) {
          changed = true;
          return [key, migrated];
        }
      }
      return [key, visit(child)];
    }));
  };

  const migrated = visit(parsed);
  return { value: changed ? JSON.stringify(migrated) : value, changed };
};

const buildUpdates = (records, fields) => records.flatMap((record) => {
  const data = {};
  for (const field of fields) {
    const migrated = migrateStoredFileUrl(record[field]);
    if (migrated) data[field] = migrated;
  }
  return Object.keys(data).length > 0 ? [{ where: { id: record.id }, data }] : [];
});

const collectChanges = async () => {
  const [patients, professionals, appointments, histories, obrasSociales] = await Promise.all([
    prisma.patient.findMany({ select: { id: true, ...Object.fromEntries(URL_FIELDS.patient.map((field) => [field, true])) } }),
    prisma.professional.findMany({ select: { id: true, ...Object.fromEntries(URL_FIELDS.professional.map((field) => [field, true])) } }),
    prisma.appointment.findMany({ where: { authorizationFileUrl: { not: null } }, select: { id: true, authorizationFileUrl: true } }),
    prisma.clinicalHistory.findMany({ where: { attachments: { not: null } }, select: { id: true, attachments: true } }),
    prisma.obraSocial.findMany({ where: { logoUrl: { not: null } }, select: { id: true, logoUrl: true } }),
  ]);

  const historyUpdates = histories.flatMap((record) => {
    const migrated = migrateAttachmentsJson(record.attachments);
    return migrated.changed ? [{ where: { id: record.id }, data: { attachments: migrated.value } }] : [];
  });

  return {
    patients: buildUpdates(patients, URL_FIELDS.patient),
    professionals: buildUpdates(professionals, URL_FIELDS.professional),
    appointments: buildUpdates(appointments, ['authorizationFileUrl']),
    histories: historyUpdates,
    obrasSociales: buildUpdates(obrasSociales, ['logoUrl']),
  };
};

const applyChanges = async (changes) => {
  const operations = Object.values(changes).flatMap((updates) => updates.map((update) => update));
  await prisma.$transaction([
    ...operations.map((operation) => {
      const model = Object.keys(changes).find((key) => changes[key].includes(operation));
      const delegate = {
        patients: prisma.patient,
        professionals: prisma.professional,
        appointments: prisma.appointment,
        histories: prisma.clinicalHistory,
        obrasSociales: prisma.obraSocial,
      }[model];
      return delegate.update(operation);
    }),
  ]);
};

const collectLocalKeys = (value, keys = []) => {
  if (typeof value === 'string' && value.startsWith(LOCAL_UPLOAD_PREFIX)) {
    keys.push(value.slice(LOCAL_UPLOAD_PREFIX.length));
  } else if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try {
      collectLocalKeys(JSON.parse(value), keys);
    } catch {
      // Ignore non-JSON text values.
    }
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectLocalKeys(item, keys));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectLocalKeys(item, keys));
  }
  return keys;
};

const countMissingLocalFiles = async (changes) => {
  const keys = Object.values(changes)
    .flatMap((updates) => updates.flatMap(({ data }) => collectLocalKeys(data)))
    .filter((key, index, allKeys) => allKeys.indexOf(key) === index);
  const missing = [];

  await Promise.all(keys.map(async (key) => {
    try {
      await fs.access(path.resolve(getUploadsDir(), key));
    } catch {
      missing.push(key);
    }
  }));

  return { checked: keys.length, missing };
};

const main = async () => {
  const changes = await collectChanges();
  const summary = Object.fromEntries(Object.entries(changes).map(([model, updates]) => [model, updates.length]));
  const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
  const localFiles = await countMissingLocalFiles(changes);

  console.log(JSON.stringify({
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    summary,
    total,
    localFiles: { checked: localFiles.checked, missing: localFiles.missing.length },
  }, null, 2));
  if (process.argv.includes('--apply') && total > 0) {
    if (localFiles.missing.length > 0) {
      throw new Error(`No se puede aplicar: faltan ${localFiles.missing.length} archivos en ${getUploadsDir()}`);
    }
    await applyChanges(changes);
  }
};

if (process.env.NODE_ENV !== 'test') {
  main()
    .catch((error) => {
      console.error(`Migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
