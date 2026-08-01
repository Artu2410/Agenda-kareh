/**
 * Servicio para procesar imágenes de tickets
 * Soporta PNG/JPG generados desde el cliente
 */

/**
 * Valida que el buffer sea una imagen PNG o JPEG válida
 * @param {Buffer} buffer - Buffer a validar
 * @returns {string|null} - Tipo MIME ('image/png' o 'image/jpeg') o null
 */
export const validateImageBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    return null;
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  return null;
};

/**
 * Procesa una imagen de ticket para almacenamiento
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @param {string} mimeType - MIME type de la imagen
 * @returns {Object} - { isValid, mimeType, extension }
 */
export const processTicketImage = (imageBuffer, mimeType) => {
  const validatedMimeType = validateImageBuffer(imageBuffer);

  if (!validatedMimeType) {
    return {
      isValid: false,
      error: 'Buffer no es una imagen PNG o JPEG válida',
      mimeType: null,
      extension: null,
    };
  }

  const extension = validatedMimeType === 'image/png' ? 'png' : 'jpg';

  return {
    isValid: true,
    mimeType: validatedMimeType,
    extension,
  };
};

/**
 * Comprime imagen JPEG manteniendo calidad (servidor)
 * Nota: Para máxima compatibilidad, es mejor dejar la compresión al cliente
 * @param {Buffer} buffer - Buffer JPEG
 * @returns {Buffer} - Buffer JPEG comprimido
 */
export const compressJpegImage = (buffer) => {
  // La compresión real requeriría 'sharp' u otra librería
  // Por ahora, devolvemos el buffer original
  // El cliente ya debería enviar imágenes optimizadas desde html2canvas
  return buffer;
};
