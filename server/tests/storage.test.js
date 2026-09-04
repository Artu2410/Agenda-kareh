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
