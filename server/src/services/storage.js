import fs from 'node:fs/promises';
import path from 'node:path';

const UPLOADS_MOUNT_PATH = '/uploads';
const DEFAULT_UPLOADS_DIR = './uploads';
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 75;

export const getUploadsDir = () => path.resolve(process.cwd(), process.env.UPLOADS_DIR || DEFAULT_UPLOADS_DIR);

const normalizeKey = (key) => {
  const normalized = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Ruta de archivo inválida');
  }
  return normalized;
};

const resolveLocalFilePath = (key) => {
  const normalizedKey = normalizeKey(key);
  const uploadsDir = getUploadsDir();
  const filePath = path.resolve(uploadsDir, normalizedKey);
  const relativePath = path.relative(uploadsDir, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Ruta de archivo inválida');
  }

  return { filePath, normalizedKey };
};

const encodeUrlKey = (key) => normalizeKey(key)
  .split('/')
  .map((segment) => encodeURIComponent(segment))
  .join('/');

export const buildLocalFileUrl = (key) => {
  const encodedKey = encodeUrlKey(key);
  const publicServerUrl = String(process.env.PUBLIC_SERVER_URL || '').trim().replace(/\/+$/, '');
  return publicServerUrl
    ? `${publicServerUrl}${UPLOADS_MOUNT_PATH}/${encodedKey}`
    : `${UPLOADS_MOUNT_PATH}/${encodedKey}`;
};

export const saveBufferToLocalStorage = async ({ buffer, key }) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Contenido de archivo inválido');
  }

  const { filePath, normalizedKey } = resolveLocalFilePath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer, { flag: 'wx' });

  return {
    key: normalizedKey,
    url: buildLocalFileUrl(normalizedKey),
  };
};

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export const createLocalFileHandler = ({
  retryAttempts = DEFAULT_RETRY_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) => async (req, res, next) => {
  let key;
  try {
    key = decodeURIComponent(String(req.path || '').replace(/^\/+/, ''));
    resolveLocalFilePath(key);
  } catch (error) {
    if (error instanceof URIError || error.message === 'Ruta de archivo inválida') {
      return res.status(400).json({ success: false, message: 'Ruta de archivo inválida' });
    }
    return next(error);
  }

  const { filePath } = resolveLocalFilePath(key);
  const attempts = Math.max(0, Number(retryAttempts) || 0);

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    const error = await new Promise((resolve) => {
      res.sendFile(filePath, { dotfiles: 'deny' }, resolve);
    });

    if (!error) {
      return undefined;
    }

    if (error.code !== 'ENOENT' || attempt === attempts) {
      if (error.code === 'ENOENT' && !res.headersSent) {
        return res.status(404).json({
          success: false,
          message: 'Archivo no disponible en este servidor. Puede estar pendiente de sincronización.',
        });
      }
      return next(error);
    }

    await wait(Number(retryDelayMs) || 0);
  }

  return next(new Error('No se pudo servir el archivo'));
};
