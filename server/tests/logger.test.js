describe('logger configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  it.each(['production', 'staging'])('disables file transports in %s', async (environment) => {
    process.env.NODE_ENV = environment;
    jest.resetModules();

    const { default: logger } = await import('../src/config/logger.js');

    expect(logger.level).toBe('info');
    expect(logger.transports.some((transport) => transport.constructor?.name === 'File')).toBe(false);
    expect(logger.transports.some((transport) => transport.constructor?.name === 'Console')).toBe(true);

    logger.close();
  });

  it('keeps file transports in development', async () => {
    process.env.NODE_ENV = 'development';
    jest.resetModules();

    const { default: logger } = await import('../src/config/logger.js');

    expect(logger.level).toBe('debug');
    expect(logger.transports.some((transport) => transport.constructor?.name === 'File')).toBe(true);

    logger.close();
  });
});
