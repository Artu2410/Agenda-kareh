import express from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildLocalFileUrl,
  createLocalFileHandler,
  getUploadsDir,
  saveBufferToLocalStorage,
} from '../src/services/storage.js';

import {
  createS3Client,
  createS3FileHandler,
  deleteFileFromStorage,
  saveBufferToS3Storage,
} from '../src/services/storage.js';
import { extractBearerToken } from '../src/utils/auth.js';
import { Readable } from 'node:stream';

describe('local file storage', () => {
  let uploadsDir;

  beforeEach(async () => {
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kareh-uploads-'));
    process.env.UPLOADS_DIR = uploadsDir;
    delete process.env.PUBLIC_SERVER_URL;
  });

  afterEach(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    delete process.env.UPLOADS_DIR;
    delete process.env.PUBLIC_SERVER_URL;
  });

  it('saves a file below UPLOADS_DIR and returns a backend-relative URL', async () => {
    const result = await saveBufferToLocalStorage({
      buffer: Buffer.from('contenido de prueba'),
      key: 'clinical-history/patient-1/file.pdf',
      contentType: 'application/pdf',
    });

    expect(result).toEqual({
      key: 'clinical-history/patient-1/file.pdf',
      url: '/uploads/clinical-history/patient-1/file.pdf',
    });
    expect(await fs.readFile(path.join(uploadsDir, result.key), 'utf8')).toBe('contenido de prueba');
  });

  it('uses PUBLIC_SERVER_URL only for the response URL', () => {
    process.env.PUBLIC_SERVER_URL = 'http://100.64.0.10:5000/';

    expect(buildLocalFileUrl('file.pdf')).toBe('http://100.64.0.10:5000/uploads/file.pdf');
  });

  it('returns a clear 404 when a synchronized file is not present yet', async () => {
    const app = express();
    app.use('/uploads', createLocalFileHandler({ retryAttempts: 1, retryDelayMs: 1 }));

    const response = await request(app).get('/uploads/missing.pdf');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Archivo no disponible en este servidor. Puede estar pendiente de sincronización.',
    });
  });

  it('rejects traversal outside the configured uploads directory', async () => {
    const app = express();
    app.use('/uploads', createLocalFileHandler());

    expect(() => buildLocalFileUrl('../package.json')).toThrow('Ruta de archivo inválida');
    expect(getUploadsDir()).toBe(uploadsDir);
  });
});

describe('Cloudflare R2 storage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.STORAGE_ACCESS_KEY_ID = 'test-access-key';
    process.env.STORAGE_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.STORAGE_BUCKET = 'kareh-uploads';
    process.env.STORAGE_REGION = 'auto';
    process.env.STORAGE_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates an S3 client with the R2 endpoint and path-style routing', async () => {
    const client = createS3Client();

    expect(client.config.forcePathStyle).toBe(true);
    expect(await client.config.region()).toBe('auto');
    expect(await client.config.endpoint()).toMatchObject({
      hostname: 'account.r2.cloudflarestorage.com',
      protocol: 'https:',
      path: '/',
    });

    await client.destroy();
  });

  it('uploads a buffer to the configured R2 bucket while preserving the relative URL', async () => {
    const send = jest.fn().mockResolvedValue({});
    const result = await saveBufferToS3Storage({
      client: { send },
      buffer: Buffer.from('contenido'),
      key: 'clinical-history/patient-1/file.pdf',
      contentType: 'application/pdf',
    });

    expect(result).toEqual({
      key: 'clinical-history/patient-1/file.pdf',
      url: '/uploads/clinical-history/patient-1/file.pdf',
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        Bucket: 'kareh-uploads',
        Key: 'clinical-history/patient-1/file.pdf',
        Body: Buffer.from('contenido'),
        ContentType: 'application/pdf',
      }),
    }));
  });

  it('deletes a normalized key from the configured R2 bucket', async () => {
    const send = jest.fn().mockResolvedValue({});

    await deleteFileFromStorage({
      client: { send },
      key: '/clinical-history/patient-1/file.pdf',
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: {
        Bucket: 'kareh-uploads',
        Key: 'clinical-history/patient-1/file.pdf',
      },
    }));
  });

  it('streams an R2 object as HTTP 200 with its content type', async () => {
    const app = express();
    const client = {
      send: jest.fn().mockResolvedValue({
        Body: Readable.from(Buffer.from('contenido r2')),
        ContentType: 'application/pdf',
        ContentLength: 12,
      }),
    };
    app.use('/uploads', createS3FileHandler({ client }));

    const response = await request(app).get('/uploads/clinical-history/file.pdf');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body.toString()).toBe('contenido r2');
    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({
      input: {
        Bucket: 'kareh-uploads',
        Key: 'clinical-history/file.pdf',
      },
    }));
  });

  it('accepts a query token only when file routes explicitly opt in', () => {
    expect(extractBearerToken({ query: { token: 'file-access-token' }, headers: {} }, { allowQueryToken: true }))
      .toBe('file-access-token');
    expect(extractBearerToken({ query: { token: 'file-access-token' }, headers: {} })).toBeNull();
  });
});
