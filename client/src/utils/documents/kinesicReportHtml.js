import {
  CLINIC,
  escapeHtml,
  formatClinicalRecord,
  formatDateAR,
  getIconUrl,
  multiline,
} from './printDocument';

const TEAL = '#0f6b6b';
const TEAL_LIGHT = '#e6f2f1';

const metricPills = (metrics = []) => metrics
  .filter((metric) => String(metric.value ?? '').trim() !== '')
  .map((metric) => `<span class="pill"><strong>${escapeHtml(metric.label)}:</strong> ${escapeHtml(metric.value)} ${escapeHtml(metric.suffix || '')}</span>`)
  .join('');

/**
 * Informe kinésico A4 con el diseño de KAREH.
 * @param {object} report datos ya completados (ver KinesicReportModal).
 */
export const buildKinesicReportHtml = (report) => {
  const techniques = (report.techniques || []).filter((row) => String(row.name || '').trim());
  const sessions = Number(report.sessions) || 0;
  const professional = report.professional || {};

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(report.title)} - ${escapeHtml(report.patient?.fullName)}</title>
<style>
  @page { size: A4; margin: 12mm 13mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 11.5px; line-height: 1.45; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${TEAL}; padding-bottom: 10px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 40px; }
  .brand-name { font-size: 26px; font-weight: 800; letter-spacing: 3px; color: ${TEAL}; line-height: 1; }
  .brand-tag { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #3fa9a0; margin-top: 4px; }
  .contact { text-align: right; font-size: 10px; color: #475569; }
  .contact strong { color: ${TEAL}; }
  .banner { margin-top: 12px; background: ${TEAL}; color: #fff; border-radius: 6px; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; }
  .banner h1 { margin: 0; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; }
  .banner .meta { display: flex; gap: 8px; }
  .banner .meta span { background: rgba(255,255,255,.18); border-radius: 4px; padding: 3px 10px; font-size: 10.5px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: ${TEAL}; border-left: 4px solid #3fa9a0; padding-left: 8px; margin: 14px 0 7px; }
  table { width: 100%; border-collapse: collapse; }
  .data td { border: 1px solid #d7e3e2; padding: 6px 9px; vertical-align: top; }
  .data .label { background: ${TEAL_LIGHT}; font-weight: 700; color: ${TEAL}; width: 17%; font-size: 10.5px; }
  .box { border: 1px solid #d7e3e2; border-radius: 6px; padding: 10px 12px; }
  .box p { margin: 0 0 8px; }
  .box .label { font-weight: 700; color: #334155; }
  .pill { display: inline-block; background: ${TEAL_LIGHT}; color: ${TEAL}; border: 1px solid #b7d8d5; border-radius: 999px; padding: 3px 12px; margin: 4px 6px 0 0; font-size: 10.5px; }
  .intro { font-style: italic; color: #475569; margin: 0 0 8px; }
  .treat th { background: ${TEAL}; color: #fff; text-align: left; padding: 7px 9px; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  .treat td { border: 1px solid #d7e3e2; padding: 8px 9px; vertical-align: top; }
  .treat tr:nth-child(even) td { background: #f6faf9; }
  .treat .name { width: 32%; font-weight: 700; color: ${TEAL}; }
  .signature { margin-top: 30px; display: flex; justify-content: flex-end; }
  .signature > div { width: 260px; text-align: center; border-top: 1.5px solid ${TEAL}; padding-top: 6px; }
  .signature .name { font-weight: 700; color: ${TEAL}; font-size: 12px; }
  .signature .sub { font-size: 10px; color: #475569; }
  /* Pie fijo: se repite en cada hoja y no empuja contenido a una página nueva. */
  .footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e2e8f0; padding-top: 4px; text-align: center; font-size: 9px; color: #94a3b8; }
  .content { padding-bottom: 22px; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<div class="content">
  <div class="header">
    <div class="brand">
      <img src="${escapeHtml(getIconUrl())}" alt="">
      <div>
        <div class="brand-name">${escapeHtml(CLINIC.name)}</div>
        <div class="brand-tag">${escapeHtml(CLINIC.tagline)}</div>
      </div>
    </div>
    <div class="contact">
      <div><strong>Dirección:</strong> ${escapeHtml(CLINIC.address)}</div>
      <div><strong>Teléfono / WhatsApp:</strong> ${escapeHtml(CLINIC.phone)}</div>
      <div><strong>Email:</strong> ${escapeHtml(CLINIC.email)}</div>
    </div>
  </div>

  <div class="banner">
    <h1>${escapeHtml(report.title)}</h1>
    <div class="meta">
      <span><strong>HC:</strong> ${escapeHtml(formatClinicalRecord(report.patient?.clinicalRecordNumber))}</span>
      <span><strong>Fecha:</strong> ${escapeHtml(formatDateAR(report.date))}</span>
    </div>
  </div>

  <h2>1. Datos del paciente</h2>
  <table class="data">
    <tr>
      <td class="label">Nombre y Apellido</td><td>${escapeHtml(report.patient?.fullName)}</td>
      <td class="label">DNI</td><td>${escapeHtml(report.patient?.dni)}</td>
    </tr>
    <tr>
      <td class="label">Fecha de Nacimiento</td><td>${escapeHtml(formatDateAR(report.patient?.birthDate))}</td>
      <td class="label">Edad</td><td>${escapeHtml(report.patient?.age ? `${report.patient.age} años` : '')}</td>
    </tr>
    <tr>
      <td class="label">Obra Social</td><td>${escapeHtml(report.coverage)}</td>
      <td class="label">N° Afiliado</td><td>${escapeHtml(report.affiliateNumber)}</td>
    </tr>
    <tr>
      <td class="label">Diagnóstico</td><td colspan="3">${escapeHtml(report.diagnosis)}</td>
    </tr>
    <tr>
      <td class="label">Médico derivante</td><td colspan="3">${escapeHtml(report.physician)}</td>
    </tr>
  </table>

  <h2>2. Estado funcional de ingreso</h2>
  <div class="box avoid-break">
    <p><span class="label">Anamnesis y Motivo de Consulta:</span><br>${multiline(report.anamnesis)}</p>
    ${metricPills(report.metricsIn)}
  </div>

  <h2>3. Tratamiento efectuado y evolución</h2>
  <p class="intro">Se realizó un ciclo terapéutico de <strong>${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'}</strong> de ${escapeHtml(report.treatmentIntro)}, aplicando las siguientes técnicas:</p>
  <table class="treat">
    <thead><tr><th>Técnica</th><th>Objetivo, aplicación y evolución observada</th></tr></thead>
    <tbody>
      ${techniques.map((row) => `<tr class="avoid-break"><td class="name">${escapeHtml(row.name)}</td><td>${multiline(row.detail)}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>4. Estado de egreso y recomendaciones</h2>
  <div class="box avoid-break">
    <p><span class="label">Estado Actual de Egreso:</span><br>${multiline(report.dischargeStatus)}</p>
    ${metricPills(report.metricsOut)}
    <p style="margin-top:10px"><span class="label">Indicación Profesional &amp; Plan de Continuidad:</span><br>${multiline(report.plan)}</p>
  </div>

  <div class="signature avoid-break">
    <div>
      <div class="name">${escapeHtml(professional.fullName ? `Lic. ${professional.fullName.replace(/^Lic\.?\s*/i, '')}` : '')}</div>
      <div class="sub">Lic. en Kinesiología y Fisiatría</div>
      <div class="sub"><strong>${escapeHtml(professional.licenseLine || '')}</strong></div>
    </div>
  </div>

</div>
  <div class="footer">${escapeHtml(CLINIC.web)} · ${escapeHtml(CLINIC.instagram)} · ${escapeHtml(CLINIC.phoneIntl)}</div>
</body>
</html>`;
};

/** "M.P. 10318 | M.N. 18900" a partir del profesional. */
export const buildLicenseLine = (professional = {}) => [
  professional.licenseNumberMP ? `M.P. ${professional.licenseNumberMP}` : '',
  professional.licenseNumber ? `M.N. ${professional.licenseNumber}` : '',
].filter(Boolean).join(' | ');
