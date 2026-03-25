const DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '54';

export const normalizePhone = (input) => {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.replace(/^0+/, '');
  }

  if (DEFAULT_COUNTRY_CODE && !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    if (digits.length <= 10) {
      digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
    }
  }

  return digits;
};
