import crypto from 'node:crypto';

/**
 * URLs firmadas para /uploads.
 *
 * Los archivos (DNI, credenciales, autorizaciones) no se sirven sin credencial.
 * La API firma cada URL de /uploads que devuelve (?exp=&sig=) y el GET de archivos
 * acepta esa firma mientras no venza. Así funcionan <img>, nuevas pestañas y la
 * ventana de impresión sin depender del access token (que vence rápido).
 */

const DEFAULT_TTL_HOURS = 6;
const SIGNATURE_LENGTH = 43; // HMAC-SHA256 en base64url completo

// Una URL de /uploads (relativa o absoluta) precedida por inicio de texto, comilla, espacio, "(", "=" o ",".
const UPLOAD_URL_PATTERN = /(^|["'\s(=,])((?:https?:\/\/[^/\s"'<>]+)?\/uploads\/[^\s"'<>?#\\)]+)(\?[^\s"'<>#\\)]*)?/g;

const getSecret = () => {
  const explicit = String(process.env.FILE_URL_SECRET || '').trim();
  if (explicit) return explicit;
  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (!jwtSecret) throw new Error('FILE_URL_SECRET o JWT_SECRET no configurado');
  // Derivado para no reutilizar el secreto del JWT tal cual.
  return crypto.createHmac('sha256', jwtSecret).update('kareh-file-urls').digest('hex');
};

const getTtlSeconds = () => {
  const hours = Number(process.env.FILE_URL_TTL_HOURS);
  return Math.round((Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_TTL_HOURS) * 3600);
};

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Clave canónica: ruta debajo de /uploads/, decodificada y sin barras iniciales. */
export const toFileKey = (pathAfterUploads) => safeDecode(String(pathAfterUploads || '')).replace(/^\/+/, '');

export const signFileKey = (key, exp) => crypto
  .createHmac('sha256', getSecret())
  .update(`${toFileKey(key)}:${exp}`)
  .digest('base64url');

/** Vencimiento redondeado a la hora: la misma URL se repite entre respuestas y el navegador la cachea. */
export const computeExpiry = (nowMs = Date.now()) => Math.ceil((nowMs / 1000 + getTtlSeconds()) / 3600) * 3600;

export const isValidFileSignature = ({ key, exp, sig, nowMs = Date.now() }) => {
  const expNumber = Number(exp);
  if (!key || !sig || !Number.isInteger(expNumber)) return false;
  if (expNumber * 1000 <= nowMs) return false;
  // Rechaza vencimientos absurdamente lejanos (firmas fabricadas con otro TTL).
  if (expNumber - nowMs / 1000 > getTtlSeconds() + 3600) return false;

  const expected = Buffer.from(signFileKey(key, expNumber));
  const provided = Buffer.from(String(sig));
  return provided.length === SIGNATURE_LENGTH
    && expected.length === provided.length
    && crypto.timingSafeEqual(expected, provided);
};

const splitUploadPath = (url) => {
  const index = url.indexOf('/uploads/');
  return { base: url, key: url.slice(index + '/uploads/'.length) };
};

export const signUploadUrlsInString = (value, nowMs = Date.now()) => {
  if (typeof value !== 'string' || !value.includes('/uploads/')) return value;
  const exp = computeExpiry(nowMs);
  return value.replace(UPLOAD_URL_PATTERN, (match, prefix, url) => {
    const { base, key } = splitUploadPath(url);
    return `${prefix}${base}?exp=${exp}&sig=${signFileKey(key, exp)}`;
  });
};

/** Quita cualquier query (firma, token) de URLs de /uploads antes de guardarlas. */
export const stripUploadUrlQueryInString = (value) => {
  if (typeof value !== 'string' || !value.includes('/uploads/')) return value;
  return value.replace(UPLOAD_URL_PATTERN, (match, prefix, url) => `${prefix}${url}`);
};

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const deepMapStrings = (value, mapString, depth = 0) => {
  if (depth > 40) return value;
  if (typeof value === 'string') return mapString(value);
  if (Array.isArray(value)) return value.map((item) => deepMapStrings(item, mapString, depth + 1));
  if (isPlainObject(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = deepMapStrings(item, mapString, depth + 1);
    }
    return result;
  }
  return value;
};

export const signUploadUrls = (body, nowMs = Date.now()) => deepMapStrings(body, (str) => signUploadUrlsInString(str, nowMs));
export const stripUploadUrlQueries = (body) => deepMapStrings(body, stripUploadUrlQueryInString);

/** Firma las URLs de /uploads en toda respuesta JSON de la API. */
export const signUploadUrlsInResponses = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      return originalJson(signUploadUrls(body));
    } catch {
      return originalJson(body);
    }
  };
  next();
};

/** Evita guardar en la base URLs con firma o token vencibles. */
export const stripUploadUrlQueriesInRequests = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = stripUploadUrlQueries(req.body);
  }
  next();
};

/** true si el request a /uploads trae una firma válida para esa ruta. */
export const hasValidFileSignature = (req) => isValidFileSignature({
  key: toFileKey(req.path),
  exp: req.query?.exp,
  sig: req.query?.sig,
});
