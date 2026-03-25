import PDFDocument from 'pdfkit';

const MM_TO_PT = 72 / 25.4;
const THERMAL_PAPER_WIDTH_MM = 57.5;
const THERMAL_MARGIN_MM = 3.5;
const CONTACT_PHONE = '+54 9 11 3201-6039';
const CONTACT_ADDRESS = 'Av. Senador Morón 782';
const WHATSAPP_POLICY_TEXT = 'Solo se pueden recuperar 2 sesiones avisando con 24 hs de anticipación por WhatsApp.';
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

const estimateTicketHeightMm = ({ patient, professional, appointments, diagnosis }) => {
  let lines = 30;
  lines += Math.ceil(String(patient?.fullName || 'N/A').length / 18);
  lines += patient?.phone ? 1 : 0;
  lines += professional?.fullName ? Math.ceil(String(professional.fullName).length / 18) : 0;
  lines += diagnosis ? Math.ceil(String(diagnosis).length / 18) + 1 : 0;
  lines += Math.max(1, (appointments || []).length) * 2;
  lines += Math.ceil(WHATSAPP_POLICY_TEXT.length / 22);
  return Math.max(145, lines * 4.8 + 20);
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
  doc.font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), { continued: false });
  doc.font('Helvetica').fontSize(8.5).text(value || 'N/A');
  doc.moveDown(0.2);
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

    doc.font('Helvetica-Bold').fontSize(13).text('KAREH', { align: 'center' });
    doc.font('Helvetica').fontSize(6.8).text('REHABILITACION Y BIENESTAR', { align: 'center' });

    drawSeparator(doc);

    doc.font('Helvetica-Bold').fontSize(7.5).text('PACIENTE', { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(9.2).text(String(patient?.fullName || 'N/A').toUpperCase(), {
      align: 'center',
    });
    doc.moveDown(0.25);

    writeLabelValue(doc, 'DNI', patient?.dni || 'N/A');
    writeLabelValue(doc, 'Telefono', patient?.phone || 'N/A');
    writeLabelValue(doc, 'Nacimiento', formatBirthDate(patient?.birthDate));
    writeLabelValue(doc, 'Cobertura', patient?.healthInsurance || 'PARTICULAR');
    writeLabelValue(doc, 'Afiliado', patient?.affiliateNumber || 'N/A');

    if (professional?.fullName) {
      writeLabelValue(doc, 'Profesional', professional.fullName);
    }

    if (diagnosis) {
      drawSeparator(doc);
      doc.font('Helvetica-Bold').fontSize(7.5).text('DIAGNOSTICO', { align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8.5).text(String(diagnosis).toUpperCase(), {
        align: 'center',
      });
      doc.moveDown(0.25);
    }

    drawSeparator(doc);

    doc.font('Helvetica-Bold').fontSize(8).text(`${(appointments || []).length} SESIONES PROGRAMADAS`, {
      align: 'center',
    });
    doc.moveDown(0.25);

    (appointments || []).forEach((appt, index) => {
      const dateLabel = formatDate(appt.date);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(`${appt.sessionNumber || index + 1}. ${dateLabel}`, { continued: true });
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(` ${appt.time || ''}`.trim(), { align: 'right' });
      doc.moveDown(0.15);
    });

    drawSeparator(doc);

    doc.font('Helvetica-Bold').fontSize(7.2).text('CONTACTO', { align: 'center' });
    drawWhatsappBadge(doc);
    doc.font('Helvetica').fontSize(8).text(CONTACT_PHONE, { align: 'center' });
    doc.moveDown(0.15);
    doc.font('Helvetica-Bold').fontSize(7.2).text('UBICACION', { align: 'center' });
    doc.font('Helvetica').fontSize(8).text(CONTACT_ADDRESS, { align: 'center' });
    doc.moveDown(0.35);
    doc.font('Helvetica-Bold').fontSize(6.8).text(WHATSAPP_POLICY_TEXT, {
      align: 'center',
    });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(7).text(`Instagram: ${INSTAGRAM_HANDLE}`, { align: 'center' });
    doc.moveDown(0.1);
    doc.font('Helvetica').fontSize(7).text(`Facebook: ${FACEBOOK_HANDLE}`, { align: 'center' });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(6.5).text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, {
      align: 'center',
    });

    doc.end();
  })
);
