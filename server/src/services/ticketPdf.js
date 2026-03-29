import PDFDocument from 'pdfkit';

const MM_TO_PT = 72 / 25.4;
const THERMAL_PAPER_WIDTH_MM = 48; // 48mm = 32 caracteres por línea
const THERMAL_MARGIN_MM = 2;
const CONTACT_PHONE = '+54 9 11 3201-6039';
const CONTACT_ADDRESS = 'Av. Senador Morón 782';
const PARTICULAR_POLICY_TEXT = 'SI FALTA A LA SESION SE COBRARA EN LA SIGUIENTE EL 50% POR LA FALTA.';
const HEALTH_INSURANCE_POLICY_TEXT = 'SE RECUPERAN HASTA 2 SESIONES AVISANDO CON 24 hs. MAS DE DOS FALTAS SEGUIDAS SIN AVISO SE DA DE BAJA AL TURNO.';
const INSTAGRAM_HANDLE = '@centro.kareh';
const FACEBOOK_HANDLE = 'Centro Kareh';

const mmToPt = (value) => value * MM_TO_PT;

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

const getPolicyText = (value) => (
  isParticularCoverage(value) ? PARTICULAR_POLICY_TEXT : HEALTH_INSURANCE_POLICY_TEXT
);

const estimateTicketHeightMm = ({ patient, professional, appointments, diagnosis }) => {
  const policyText = getPolicyText(patient?.healthInsurance);
  let lines = 32;
  lines += Math.ceil(String(patient?.fullName || 'N/A').length / 24);
  lines += patient?.phone ? 1 : 0;
  lines += professional?.fullName ? Math.ceil(String(professional.fullName).length / 24) : 0;
  lines += diagnosis ? Math.ceil(String(diagnosis).length / 24) + 1 : 0;
  lines += Math.max(1, (appointments || []).length) * 2;
  lines += Math.ceil(policyText.length / 22) + 2;
  return Math.max(155, lines * 5 + 18);
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

const writeLabelValue = (doc, label, value) => {
  doc.font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), { continued: false });
  doc.font('Helvetica-Bold').fontSize(9.5).text(value || 'N/A');
  doc.moveDown(0.28);
};

const drawWhatsappBadge = (doc) => {
  const badgeSize = 16;
  const centerX = doc.page.width / 2;
  const badgeX = centerX - (badgeSize / 2);
  const badgeY = doc.y;

  doc.save();
  doc.circle(centerX, badgeY + (badgeSize / 2), badgeSize / 2).fill('#25D366');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('WA', badgeX, badgeY + 4.2, {
      width: badgeSize,
      align: 'center',
    });
  doc.restore();
  doc.moveDown(1.1);
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

    // HEADER - KAREH en doble tamaño (48mm)
    doc.font('Helvetica-Bold').fontSize(20).text('KAREH', { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(7.5).text('REHABILITACION', { align: 'center' });

    drawSeparator(doc);

    // PACIENTE - Bold y ALL CAPS
    doc.font('Helvetica-Bold').fontSize(8).text('PACIENTE', { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(11.5).text(String(patient?.fullName || 'N/A').toUpperCase(), {
      align: 'center',
    });
    doc.moveDown(0.4);

    // DATOS DE COBERTURA - Formato comprimido
    writeLabelValue(doc, 'DNI', patient?.dni || 'N/A');
    writeLabelValue(doc, 'F.NAC', formatBirthDate(patient?.birthDate));
    writeLabelValue(doc, 'COBERTURA', coverageLabel);
    writeLabelValue(doc, 'AFIL', patient?.affiliateNumber || 'N/A');

    // Banderas de salud (etiquetas cortas)
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(8).text(
      `[${patient?.hasCancer ? 'X' : ' '}] ONCO  [${patient?.hasMarcapasos ? 'X' : ' '}] MCP  [${patient?.usesEA ? 'X' : ' '}] EA`,
      { align: 'center' }
    );

    if (diagnosis) {
      drawSeparator(doc);
      doc.font('Helvetica-Bold').fontSize(8).text('DIAGNOSTICO', { align: 'center' });
      doc.font('Helvetica-Bold').fontSize(9).text(String(diagnosis).toUpperCase(), {
        align: 'center',
      });
      doc.moveDown(0.35);
    }

    drawSeparator(doc);

    // CRONOGRAMA - Lista limpia N° | FECHA | HORA
    doc.font('Helvetica-Bold').fontSize(9).text(`${(appointments || []).length} SESIONES`, {
      align: 'center',
    });
    doc.moveDown(0.25);

    doc.font('Helvetica-Bold').fontSize(8).text('CRONOGRAMA', { align: 'center' });
    doc.moveDown(0.2);

    (appointments || []).forEach((appt, index) => {
      const dateLabel = formatDate(appt.date);
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(`${appt.sessionNumber || index + 1}. ${dateLabel}`, { continued: true });
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(` ${appt.time || ''}`.trim(), { align: 'right' });
      doc.moveDown(0.18);
    });

    drawSeparator(doc);

    // POLÍTICA DE CANCELACIÓN
    doc.font('Helvetica-Bold').fontSize(7.75).text(policyText, {
      align: 'center',
    });
    doc.moveDown(0.35);

    drawSeparator(doc);

    // PIE - Dirección, Teléfono
    doc.font('Helvetica-Bold').fontSize(8).text('CONTACTO', { align: 'center' });
    drawWhatsappBadge(doc);
    doc.font('Helvetica-Bold').fontSize(8).text(CONTACT_PHONE, { align: 'center' });
    doc.moveDown(0.2);

    doc.font('Helvetica-Bold').fontSize(7.25).text(CONTACT_ADDRESS, { align: 'center' });
    doc.moveDown(0.25);

    doc.font('Helvetica').fontSize(6.75).text(`${INSTAGRAM_HANDLE} | ${FACEBOOK_HANDLE}`, { align: 'center' });
    doc.moveDown(0.12);
    doc.font('Helvetica').fontSize(6.75).text(`Emitido: ${new Date().toLocaleDateString('es-AR')}`, {
      align: 'center',
    });

    doc.end();
  })
);
