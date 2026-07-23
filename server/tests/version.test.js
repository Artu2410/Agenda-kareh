import express from 'express';
import request from 'supertest';
import createVersionRoutes from '../src/routes/version.routes.js';
import { getRuntimeVersionInfo, getStartupMetadata } from '../src/config/runtimeInfo.js';

describe('runtime version info', () => {
  const originalEnv = process.env;
  const deployedAt = '2026-05-28T22:00:00.000Z';

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_VERSION: '2026.05.28-rc1',
      COMMIT_SHA: 'cb5f418',
      NODE_ENV: 'production',
      PORT: '10000',
      DEPLOYED_AT: deployedAt,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves the current runtime metadata', () => {
    expect(getRuntimeVersionInfo()).toEqual({
      version: '2026.05.28-rc1',
      commit: 'cb5f418',
      environment: 'production',
      deployedAt,
    });
  });

  it('adds startup details for boot logs', () => {
    const metadata = getStartupMetadata(5000);

    expect(metadata).toMatchObject({
      version: '2026.05.28-rc1',
      commit: 'cb5f418',
      environment: 'production',
      deployedAt,
      port: 5000,
    });
    expect(metadata.startedAt).toEqual(expect.any(String));
  });

  it('exposes the runtime metadata through /api/version', async () => {
    const app = express();
    app.use('/api', createVersionRoutes());

    const response = await request(app)
      .get('/api/version')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      version: '2026.05.28-rc1',
      commit: 'cb5f418',
      environment: 'production',
      deployedAt,
    });
  });
});
