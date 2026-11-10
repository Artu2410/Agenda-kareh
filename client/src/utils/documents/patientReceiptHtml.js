import {
  CLINIC,
  escapeHtml,
  formatCurrencyAR,
  formatDateAR,
  formatDniAR,
  getLogoUrl,
  multiline,
} from './printDocument';

const NAVY = '#0f172a';

/**
 * Comprobante de prestación A4, NO válido como factura ante ARCA.
 * Recibe el comprobante tal como lo devuelve POST/GET /api/receipts.
 */
export const buildPatientReceiptHtml = (receipt) => {
  const amount = formatCurrencyAR(receipt.amount);
  const professionalName = receipt.professionalName
    ? `Lic. ${String(receipt.professionalName).replace(/^Lic\.?\s*/i, '')}`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Comprobante ${escapeHtml(receipt.displayNumber)} - ${escapeHtml(receipt.patientName)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1e293b; font-size: 12px; }
  .top { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: start; }
  .brand img { height: 52px; }
  .brand h1 { margin: 10px 0 2px; font-size: 26px; color: ${NAVY}; letter-spacing: .5px; }
  .brand .sub { color: #475569; font-size: 12px; }
  .brand .muted { color: #64748b; font-size: 11px; line-height: 1.4; }
  .x-box { border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; padding: 8px 12px; text-align: center; width: 140px; }
  .x-box .x { font-size: 26px; font-weight: 700; color: ${NAVY}; line-height: 1; }
  .x-box .legend { font-size: 8.5px; text-transform: uppercase; color: #475569; margin-top: 4px; line-height: 1.25; }
  .doc { text-align: right; }
  .doc .kind { font-weight: 700; letter-spacing: 1px; color: #334155; }
  .doc .num { font-size: 18px; font-weight: 700; color: ${NAVY}; }
  .doc .line { color: #475569; }
  hr { border: 0; border-top: 2px solid #cbd5e1; margin: 18px 0; }
  table { width: 100%; border-collapse: collapse; }
  .data td { border: 1px solid #e2e8f0; padding: 9px 10px; vertical-align: top; }
  .data .label { background: #f1f5f9; font-weight: 700; width: 18%; }
  .items { margin-top: 18px; }
  .items th { background: ${NAVY}; color: #fff; padding: 9px 10px; text-align: left; font-size: 12px; }
  .items th.num, .items td.num { text-align: right; white-space: nowrap; }
  .items td { border: 1px solid #e2e8f0; padding: 10px; vertical-align: top; }
  .total { width: 46%; margin: 14px 0 0 auto; }
  .total td { border: 1px solid #e2e8f0; padding: 10px; background: #f1f5f9; font-weight: 700; font-size: 14px; }
  .total td:last-child { text-align: right; }
  .signs { display: flex; justify-content: space-around; margin-top: 70px; }
  .signs div { width: 40%; border-top: 1.5px solid #334155; padding-top: 6px; text-align: center; color: #475569; font-size: 11px; }
  .disclaimer { margin-top: 26px; text-align: center; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
  .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; font-size: 10px; color: #64748b; }
</style>
</head>
<body>
  <div class="top">
    <div class="brand">
      <img src="${escapeHtml(getLogoUrl())}" alt="">
      <h1>${escapeHtml(CLINIC.legalName)}</h1>
      <div class="sub">${escapeHtml(CLINIC.subtitle)}</div>
      <div class="muted">${escapeHtml(CLINIC.address)}<br>${escapeHtml(CLINIC.email)}<br>Tel: ${escapeHtml(CLINIC.phone)}</div>
    </div>
    <div class="x-box">
      <div class="x">X</div>
      <div class="legend">Documento no válido como factura ante ARCA</div>
    </div>
    <div class="doc">
      <div class="kind">COMPROBANTE</div>
      <div class="num">N° ${escapeHtml(receipt.displayNumber)}</div>
      <div class="line">Fecha: <strong>${escapeHtml(formatDateAR(receipt.issueDate))}</strong></div>
      <div class="line">Localidad: ${escapeHtml(CLINIC.city)}</div>
    </div>
  </div>

  <hr>

  <table class="data">
    <tr>
      <td class="label">Paciente:</td><td>${escapeHtml(receipt.patientName)}</td>
      <td class="label">DNI:</td><td>${escapeHtml(formatDniAR(receipt.patientDni))}</td>
    </tr>
    <tr>
      <td class="label">Obra Social / Prepaga:</td><td>${escapeHtml(receipt.coverage || 'Particular')}</td>
      <td class="label">N° de Afiliado:</td><td>${escapeHtml(receipt.affiliateNumber || '—')}</td>
    </tr>
    <tr>
      <td class="label">Profesional:</td><td>${escapeHtml(professionalName || '—')}</td>
      <td class="label">Matrícula:</td><td>${escapeHtml(receipt.professionalLicense || '—')}</td>
    </tr>
    <tr>
      <td class="label">Diagnóstico:</td><td colspan="3">${escapeHtml(receipt.diagnosis || '—')}</td>
    </tr>
  </table>

  <table class="items">
    <thead><tr><th style="width:8%">Cant.</th><th>Descripción de la Práctica / Prestación</th><th class="num" style="width:18%">Unitario</th><th class="num" style="width:18%">Subtotal</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${multiline(receipt.description)}</td><td class="num">${escapeHtml(amount)}</td><td class="num">${escapeHtml(amount)}</td></tr>
    </tbody>
  </table>

  <table class="total"><tr><td>Total a Abonar:</td><td>${escapeHtml(amount)}</td></tr></table>

  <div class="signs">
    <div>Firma y Sello del Profesional</div>
    <div>Firma / Conformidad del Paciente</div>
  </div>

  <div class="disclaimer">Comprobante interno de prestación. No válido como factura ni recibo fiscal ante ARCA.</div>
  <div class="footer">${escapeHtml(CLINIC.web)} · ${escapeHtml(CLINIC.instagram)} · ${escapeHtml(CLINIC.phoneIntl)}</div>
</body>
</html>`;
};
