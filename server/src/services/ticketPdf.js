import PDFDocument from 'pdfkit';

const formatDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR');
};

export const buildTicketPdf = async ({ patient, professional, appointments, diagnosis }) => (
  new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];

    doc.on('data', (d) => buffers.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    doc.fontSize(22).text('KAREH', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text('Rehabilitación y Bienestar', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(12).text(`Paciente: ${patient?.fullName || 'N/A'}`);
    doc.fontSize(12).text(`DNI: ${patient?.dni || 'N/A'}`);
    if (patient?.phone) doc.fontSize(12).text(`Teléfono: ${patient.phone}`);
    doc.moveDown(0.5);

    if (professional?.fullName) {
      doc.fontSize(12).text(`Profesional: ${professional.fullName}`);
    }

    if (diagnosis) {
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Diagnóstico: ${diagnosis.toUpperCase()}`);
    }

    doc.moveDown(1);
    doc.fontSize(14).text('Cronograma de sesiones', { underline: true });
    doc.moveDown(0.5);

    (appointments || []).forEach((appt, idx) => {
      const dateLabel = formatDate(appt.date);
      doc.fontSize(11).text(`${appt.sessionNumber || idx + 1}. ${dateLabel} ${appt.time || ''}`);
    });

    doc.end();
  })
);
