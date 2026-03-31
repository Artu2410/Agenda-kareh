import PDFDocument from 'pdfkit';

const MM_TO_PT = 72 / 25.4;
const THERMAL_PAPER_WIDTH_MM = 48; // 48mm = 32 caracteres por línea
const THERMAL_MARGIN_MM = 2;
const CONTACT_PHONE = '+54 9 11 3201-6039';
const CONTACT_ADDRESS = 'Av. Senador Morón 782, Bella Vista';
const PARTICULAR_POLICY_TEXT = 'FALTA SIN AVISO RECARGO DEL 50% EN LA PROXIMA SESION.';
const HEALTH_INSURANCE_POLICY_TEXT = 'SE RECUPERAN HASTA 2 SESIONES AVISANDO CON 24 HS. MAS DE DOS FALTAS SEGUIDAS SIN AVISO SE DA DE BAJA AL TURNO.';
const WAIT_TOLERANCE_TEXT = 'TOLERANCIA DE ESPERA 15 MIN MAXIMO.';

const mmToPt = (value) => value * MM_TO_PT;
const getPrintableWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

const formatDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date).replace('.', '').toUpperCase();
};

const formatBirthDate = (value) => {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('es-AR');
};

const normalizeCoverage = (value) => String(value || '').trim();

const isParticularCoverage = (value) => {
  const normalized = normalizeCoverage(value).toLowerCase();
  return !normalized || normalized === 'particular';
};

const getCoverageLabel = (value) => (
  isParticularCoverage(value) ? 'PARTICULAR' : normalizeCoverage(value).toUpperCase()
);

const getPolicyText = (value) => [
  isParticularCoverage(value) ? PARTICULAR_POLICY_TEXT : HEALTH_INSURANCE_POLICY_TEXT,
  WAIT_TOLERANCE_TEXT,
].join('\n');

const estimateTicketHeightMm = ({ patient, professional, appointments, diagnosis }) => {
  const policyText = getPolicyText(patient?.healthInsurance);
  let lines = 36;
  lines += Math.ceil(String(patient?.fullName || 'N/A').length / 21);
  lines += patient?.phone ? 1 : 0;
  lines += professional?.fullName ? Math.ceil(String(professional.fullName).length / 21) : 0;
  lines += diagnosis ? Math.ceil(String(diagnosis).length / 21) + 1 : 0;
  lines += Math.max(1, (appointments || []).length) * 2;
  lines += policyText.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 18)), 0) + 2;
  return Math.max(175, lines * 5.8 + 20);
};

const drawSeparator = (doc) => {
  doc.moveDown(0.25);
  doc
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.35);
};

const writeCenteredText = (doc, text, { font = 'Helvetica', fontSize = 8, moveDown = 0 } = {}) => {
  doc
    .font(font)
    .fontSize(fontSize)
    .text(text, doc.page.margins.left, doc.y, {
      width: getPrintableWidth(doc),
      align: 'center',
    });

  doc.x = doc.page.margins.left;
  if (moveDown) doc.moveDown(moveDown);
};

const writeLabelValue = (doc, label, value) => {
  doc.font('Helvetica-Bold').fontSize(8.5).text(label.toUpperCase(), { continued: false });
  doc.font('Helvetica-Bold').fontSize(10.5).text(value || 'N/A');
  doc.moveDown(0.34);
};

const drawWhatsappBadge = (doc) => {
  const badgeSize = 18;
  const centerX = doc.page.width / 2;
  const badgeX = centerX - (badgeSize / 2);
  const badgeY = doc.y;

  doc.save();
  doc.circle(centerX, badgeY + (badgeSize / 2), badgeSize / 2).fill('#25D366');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .text('WA', badgeX, badgeY + 4.8, {
      width: badgeSize,
      align: 'center',
    });
  doc.restore();
  doc.moveDown(1.2);
  doc.x = doc.page.margins.left;
};

export const buildTicketPdf = async ({ patient, professional, appointments, diagnosis }) => (
  new Promise((resolve) => {
    const policyText = getPolicyText(patient?.healthInsurance);
    const coverageLabel = getCoverageLabel(patient?.healthInsurance);
    const doc = new PDFDocument({
      size: [mmToPt(THERMAL_PAPER_WIDTH_MM), mmToPt(estimateTicketHeightMm({
        patient,
        professional,
        appointments,
        diagnosis,
      }))],
      margin: mmToPt(THERMAL_MARGIN_MM),
    });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // HEADER
    doc.font('Helvetica-Bold').fontSize(24).text('KAREH', { align: 'center' });

    drawSeparator(doc);

    // PACIENTE
    doc.font('Helvetica-Bold').fontSize(9).text('PACIENTE', { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(13).text(String(patient?.fullName || 'N/A').toUpperCase(), {
      align: 'center',
    });
    doc.moveDown(0.45);

    // DATOS DE COBERTURA
    writeLabelValue(doc, 'DNI', patient?.dni || 'N/A');
    writeLabelValue(doc, 'F.NAC', formatBirthDate(patient?.birthDate));
    writeLabelValue(doc, 'COBERTURA', coverageLabel);
    writeLabelValue(doc, 'AFIL', patient?.affiliateNumber || 'N/A');

    // Banderas de salud
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(9).text(
      `[${patient?.hasCancer ? 'X' : ' '}] ONCO  [${patient?.hasMarcapasos ? 'X' : ' '}] MCP  [${patient?.usesEA ? 'X' : ' '}] EA`,
      { align: 'center' }
    );

    if (diagnosis) {
      drawSeparator(doc);
      doc.font('Helvetica-Bold').fontSize(9).text('DIAGNOSTICO', { align: 'center' });
      doc.font('Helvetica-Bold').fontSize(10).text(String(diagnosis).toUpperCase(), {
        align: 'center',
      });
      doc.moveDown(0.4);
    }

    drawSeparator(doc);

    // CRONOGRAMA
    doc.font('Helvetica-Bold').fontSize(10).text(`${(appointments || []).length} SESIONES`, {
      align: 'center',
    });
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(9).text('CRONOGRAMA', { align: 'center' });
    doc.moveDown(0.25);

    (appointments || []).forEach((appt, index) => {
      const dateLabel = formatDate(appt.date);
      doc
        .font('Helvetica-Bold')
        .fontSize(9.25)
        .text(`${appt.sessionNumber || index + 1}. ${dateLabel}`, { continued: true });
      doc
        .font('Helvetica-Bold')
        .fontSize(9.25)
        .text(` ${appt.time || ''}`.trim(), { align: 'right' });
      doc.moveDown(0.22);
    });

    drawSeparator(doc);

    // POLITICAS
    doc.font('Helvetica-Bold').fontSize(8.75).text(policyText, {
      align: 'center',
      lineGap: 1.4,
    });
    doc.moveDown(0.4);

    drawSeparator(doc);

    drawWhatsappBadge(doc);
    writeCenteredText(doc, CONTACT_PHONE, { font: 'Helvetica-Bold', fontSize: 9, moveDown: 0.25 });
    writeCenteredText(doc, CONTACT_ADDRESS, { font: 'Helvetica-Bold', fontSize: 8.5, moveDown: 0.3 });
    writeCenteredText(doc, `Emitido: ${new Date().toLocaleDateString('es-AR')}`, { font: 'Helvetica', fontSize: 7.25 });

    doc.end();
  })
);
