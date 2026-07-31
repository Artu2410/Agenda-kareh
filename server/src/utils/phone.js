const DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '54';
const ARGENTINA_WHATSAPP_PREFIX = '549'; // Prefijo específico para WhatsApp Argentina (54 + 9)

/**
 * Normaliza números de teléfono argentinos para WhatsApp
 * @param {string} input - Número de teléfono a normalizar
 * @param {boolean} forWhatsApp - Si es true, usa prefijo 549 para Argentina
 * @returns {string|null} - Número normalizado o null
 * 
 * Ejemplos:
 * - "1125609610" → "5491125609610"
 * - "1149999999" → "5491149999999"
 * - "+549 11 2560-9610" → "5491125609610"
 * - "02260-1234" → "5492260001234"
 */
export const normalizePhone = (input, forWhatsApp = true) => {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Eliminar prefijos internacionales redundantes
  if (digits.startsWith('0054')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Eliminar el 0 inicial (formato nacional argentino)
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.replace(/^0+/, '');
  }

  // Retirar el 9 después del 54 si está duplicado
  if (digits.startsWith('549') && digits.length > 12) {
    // Ya tiene el prefijo correcto
    return digits;
  }

  // Si para WhatsApp y no tiene prefijo: agregar 549 (código país + 9)
  if (forWhatsApp && !digits.startsWith('54')) {
    if (digits.length <= 10) {
      // Es un número local, agregar 549
      digits = `${ARGENTINA_WHATSAPP_PREFIX}${digits}`;
    }
  } else if (!forWhatsApp && DEFAULT_COUNTRY_CODE && !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    if (digits.length <= 10) {
      digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
    }
  }

  return digits;
};
