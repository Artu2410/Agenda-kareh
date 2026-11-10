/**
 * Utilidades compartidas para documentos imprimibles (informe kinésico, comprobante).
 * Todo dato dinámico pasa por escapeHtml antes de entrar al HTML.
 */

export const CLINIC = Object.freeze({
  name: 'KAREH',
  legalName: 'CENTRO KAREH',
  tagline: 'Kinesiología & Rehabilitación',
  subtitle: 'Kinesiología, Fisioterapia y Rehabilitación',
  address: 'Av. Senador Morón 782, Bella Vista',
  city: 'Bella Vista, Buenos Aires',
  phone: '11 3201 6039',
  phoneIntl: '+54 9 11 3201-6039',
  email: 'centrokareh@gmail.com',
  web: 'www.kareh.com.ar',
  instagram: '@centro.kareh',
});

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** Texto multilínea → HTML con <br>, escapado. */
export const multiline = (value) => escapeHtml(value).replace(/\r?\n/g, '<br>');

const publicAssetUrl = (fileName) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/${fileName}`;
};

/** Logo completo (ícono + KAREH). */
export const getLogoUrl = () => publicAssetUrl('kareh-logo.png');
/** Solo el ícono, para encabezados que ya escriben "KAREH". */
export const getIconUrl = () => publicAssetUrl('kareh-icon.png');

export const formatDateAR = (value) => {
  if (!value) return '';
  const raw = String(value);
  // Fechas "YYYY-MM-DD" o ISO a mediodía: se toma la parte de fecha sin corrimiento horario.
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const calculateAge = (birthDate, today = new Date()) => {
  const match = String(birthDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const year = Number(match[1]);
  if (year <= 1900) return '';
  let age = today.getFullYear() - year;
  const monthDiff = (today.getMonth() + 1) - Number(match[2]);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < Number(match[3]))) age -= 1;
  return age >= 0 ? String(age) : '';
};

export const formatCurrencyAR = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
}).format(Number(value) || 0);

export const formatDniAR = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return String(value || '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Mismo formato que la ficha de historia clínica ("HC 0042"), sin el prefijo.
export const formatClinicalRecord = (number) => {
  const numericValue = Number(number);
  return Number.isInteger(numericValue) && numericValue > 0 ? String(numericValue).padStart(4, '0') : '';
};

export const todayISO = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Abre el documento en una ventana nueva lista para imprimir o "Guardar como PDF".
 * Devuelve false si el navegador bloqueó la ventana emergente.
 */
export const openPrintWindow = (html, { autoPrint = true } = {}) => {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  if (autoPrint) {
    const triggerPrint = () => {
      printWindow.focus();
      printWindow.print();
    };
    // Espera al logo para que salga en la impresión.
    const logo = printWindow.document.querySelector('img');
    if (logo && !logo.complete) {
      logo.addEventListener('load', triggerPrint, { once: true });
      logo.addEventListener('error', triggerPrint, { once: true });
    } else {
      setTimeout(triggerPrint, 150);
    }
  }
  return true;
};
