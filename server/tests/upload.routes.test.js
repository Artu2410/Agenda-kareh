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

  it('rejects files whose content does not match an allowed type', async () => {
    const app = express();
    app.use('/api/uploads', createUploadRoutes());

    await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'foto.png',
        contentType: 'image/png',
      })
      .expect(400);

    await expect(fs.readdir(path.join(uploadsDir, 'clinical-history'))).rejects.toThrow();
  });

  it('stores the detected type even if the browser declared another one', async () => {
    const app = express();
    app.use('/api/uploads', createUploadRoutes());
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', png, { filename: 'scan.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(response.body.type).toBe('image/png');
  });
});
