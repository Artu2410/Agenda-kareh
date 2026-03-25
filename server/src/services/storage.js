import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const {
  STORAGE_BUCKET,
  STORAGE_REGION = 'us-east-1',
  STORAGE_ENDPOINT,
  STORAGE_PUBLIC_URL,
  STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} = process.env;

const accessKeyId = STORAGE_ACCESS_KEY_ID || AWS_ACCESS_KEY_ID;
const secretAccessKey = STORAGE_SECRET_ACCESS_KEY || AWS_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  region: STORAGE_REGION,
  endpoint: STORAGE_ENDPOINT || undefined,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  forcePathStyle: Boolean(STORAGE_ENDPOINT) && !String(STORAGE_ENDPOINT).includes('amazonaws.com'),
});

export const assertStorageConfig = () => {
  if (!STORAGE_BUCKET || !accessKeyId || !secretAccessKey) {
    throw new Error('Storage no configurado');
  }
};

export const buildPublicUrl = (key) => {
  if (STORAGE_PUBLIC_URL) {
    return `${String(STORAGE_PUBLIC_URL).replace(/\/$/, '')}/${key}`;
  }
  if (STORAGE_ENDPOINT) {
    return `${String(STORAGE_ENDPOINT).replace(/\/$/, '')}/${STORAGE_BUCKET}/${key}`;
  }
  return `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/${key}`;
};

export const uploadBufferToStorage = async ({ buffer, key, contentType }) => {
  assertStorageConfig();
  await s3.send(new PutObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return buildPublicUrl(key);
};
