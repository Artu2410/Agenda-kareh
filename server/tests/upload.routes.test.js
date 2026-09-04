import express from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import createUploadRoutes from '../src/routes/upload.routes.js';

describe('upload routes', () => {
  let uploadsDir;

  beforeEach(async () => {
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kareh-upload-route-'));
    process.env.UPLOADS_DIR = uploadsDir;
    process.env.PUBLIC_SERVER_URL = 'http://100.64.0.10:5000';
  });

  afterEach(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    delete process.env.UPLOADS_DIR;
    delete process.env.PUBLIC_SERVER_URL;
  });

  it('stores the multipart file locally and returns the active server URL', async () => {
    const app = express();
    app.use('/api/uploads', createUploadRoutes());

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('%PDF-test'), {
        filename: 'autorizacion.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body.url).toMatch(/^http:\/\/100\.64\.0\.10:5000\/uploads\/clinical-history\//);
    expect(response.body.name).toBe('autorizacion.pdf');

    const storedFiles = await fs.readdir(path.join(uploadsDir, 'clinical-history'));
    expect(storedFiles).toHaveLength(1);
    expect(await fs.readFile(path.join(uploadsDir, 'clinical-history', storedFiles[0]), 'utf8')).toBe('%PDF-test');
  });
});
