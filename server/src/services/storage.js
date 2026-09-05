import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

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

export const getStorageProvider = () => String(process.env.STORAGE_PROVIDER || 'local').trim().toLowerCase();

const getS3Config = () => {
  const accessKeyId = String(process.env.STORAGE_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.STORAGE_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(process.env.STORAGE_BUCKET || '').trim();
  const endpoint = String(process.env.STORAGE_ENDPOINT || '').trim().replace(/\/+$/, '');

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    throw new Error('Storage no configurado');
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region: String(process.env.STORAGE_REGION || 'auto').trim() || 'auto',
  };
};

export const createS3Client = () => {
  const config = getS3Config();
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
};

let s3Client;
const getS3Client = () => {
  if (!s3Client) s3Client = createS3Client();
  return s3Client;
};

const getS3Bucket = () => getS3Config().bucket;

export const saveBufferToLocalStorage = async ({ buffer, key }) => {
  if (!Buffer.isBuffer(buffer)) throw new Error('Contenido de archivo inválido');

  const { filePath, normalizedKey } = resolveLocalFilePath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer, { flag: 'wx' });

  return { key: normalizedKey, url: buildLocalFileUrl(normalizedKey) };
};

export const saveBufferToS3Storage = async ({ buffer, key, contentType, client = getS3Client() }) => {
  if (!Buffer.isBuffer(buffer)) throw new Error('Contenido de archivo inválido');

  const normalizedKey = normalizeKey(key);
  await client.send(new PutObjectCommand({
    Bucket: getS3Bucket(),
    Key: normalizedKey,
    Body: buffer,
    ...(contentType ? { ContentType: contentType } : {}),
  }));

  return { key: normalizedKey, url: buildLocalFileUrl(normalizedKey) };
};

export const saveBufferToStorage = async (input) => getStorageProvider() === 's3'
  ? saveBufferToS3Storage(input)
  : saveBufferToLocalStorage(input);

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
    const error = await new Promise((resolve) => res.sendFile(filePath, { dotfiles: 'deny' }, resolve));
    if (!error) return undefined;
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

const isMissingObjectError = (error) => error?.name === 'NoSuchKey'
  || error?.$metadata?.httpStatusCode === 404;

export const createS3FileHandler = ({ client } = {}) => async (req, res, next) => {
  let key;
  try {
    key = normalizeKey(decodeURIComponent(String(req.path || '').replace(/^\/+/, '')));
  } catch (error) {
    if (error instanceof URIError || error.message === 'Ruta de archivo inválida') {
      return res.status(400).json({ success: false, message: 'Ruta de archivo inválida' });
    }
    return next(error);
  }

  try {
    const storageClient = client || getS3Client();
    const response = await storageClient.send(new GetObjectCommand({ Bucket: getS3Bucket(), Key: key }));
    if (response.ContentType) res.setHeader('Content-Type', response.ContentType);
    if (response.ContentLength !== undefined) res.setHeader('Content-Length', response.ContentLength);
    if (response.ETag) res.setHeader('ETag', response.ETag);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (response.Body?.pipe) response.Body.pipe(res);
    else if (response.Body) {
      for await (const chunk of response.Body) res.write(chunk);
      res.end();
    } else return res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
    return undefined;
  } catch (error) {
    if (isMissingObjectError(error) && !res.headersSent) {
      return res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
    }
    return next(error);
  }
};

export const deleteFileFromStorage = async ({ key, client = getS3Client() } = {}) => {
  const normalizedKey = normalizeKey(key);
  if (getStorageProvider() === 's3') {
    await client.send(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: normalizedKey }));
    return { key: normalizedKey };
  }

  const { filePath } = resolveLocalFilePath(normalizedKey);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { key: normalizedKey };
};

export const createFileHandler = (options = {}) => getStorageProvider() === 's3'
  ? createS3FileHandler(options)
  : createLocalFileHandler(options);
