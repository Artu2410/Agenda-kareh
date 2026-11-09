/**
 * Detecta el tipo real de un archivo por sus primeros bytes ("magic bytes").
 * No confiamos en el Content-Type que manda el navegador: se puede falsificar.
 * Devuelve { mime, ext } o null si no es un tipo permitido.
 */
const startsWith = (buffer, bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);

const SIGNATURES = [
  { mime: 'image/jpeg', ext: '.jpg', test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { mime: 'image/png', ext: '.png', test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: 'image/gif', ext: '.gif', test: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) },
  {
    mime: 'image/webp',
    ext: '.webp',
    test: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
  { mime: 'application/pdf', ext: '.pdf', test: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]) },
];

export const detectFileType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  const match = SIGNATURES.find((signature) => signature.test(buffer));
  return match ? { mime: match.mime, ext: match.ext } : null;
};

export default detectFileType;
