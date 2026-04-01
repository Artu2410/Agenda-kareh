import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Printer, Download, Loader2, Send } from 'lucide-react';
import html2canvas from 'html2canvas';
import api from '@/services/api';

const UNKNOWN_BIRTHDATE = '1900-01-01';
const THERMAL_WIDTH_MM = 48; // 48mm = 32 caracteres por línea (fuente monoespaciada)
const THERMAL_PREVIEW_WIDTH_PX = 420;
const CONTACT_PHONE = '+54 9 11 3201-6039';
const CONTACT_ADDRESS = 'Av. Senador Morón 782, Bella Vista';
const PARTICULAR_POLICY_TEXT = 'FALTA SIN AVISO RECARGO DEL 50% EN LA PROXIMA SESION.';
const HEALTH_INSURANCE_POLICY_TEXT = 'SE RECUPERAN HASTA 2 SESIONES AVISANDO CON 24 HS. MAS DE DOS FALTAS SEGUIDAS SIN AVISO SE DA DE BAJA AL TURNO.';
const WAIT_TOLERANCE_TEXT = 'TOLERANCIA DE ESPERA 15 MIN MAXIMO.';
const PREVIEW_SECTION_TEXT_SIZE = 'clamp(1.55rem, 5.2vw, 2rem)';
const PREVIEW_NAME_TEXT_SIZE = 'clamp(1.75rem, 6vw, 2.35rem)';
const PREVIEW_BODY_TEXT_SIZE = 'clamp(1.35rem, 4.8vw, 1.95rem)';
const PREVIEW_POLICY_TEXT_SIZE = 'clamp(1.2rem, 4.3vw, 1.75rem)';
const PREVIEW_FOOTER_TEXT_SIZE = 'clamp(1.05rem, 3.8vw, 1.45rem)';

const buildWhatsappBadgeMarkup = () => `
  <span class="wa-badge" aria-hidden="true">
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <text x="16" y="21" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">WA</text>
    </svg>
  </span>
`;

const parseTicketDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    }

    const utcMidnight = value.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?(?:Z|\+00:00)$/);
    if (utcMidnight) {
      const [, year, month, day] = utcMidnight;
      return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toThermalDate = (value) => {
  if (!value) return 'N/A';
  const date = parseTicketDate(value);
  if (!date) return 'N/A';

  return format(date, 'EEE dd/MM', { locale: es }).replace('.', '').toUpperCase();
};

const toIssueDate = () => format(new Date(), "d 'de' MMMM, yyyy", { locale: es });

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

const buildPrintHtml = ({ printablePatient, printableDiagnosis, sortedAppointments, policyText }) => {
  const appointmentRows = sortedAppointments.map((appt, idx) => `
    <div class="row session-row">
      <span class="session-index">${appt.sessionNumber || idx + 1}</span>
      <span class="session-date">${toThermalDate(appt.date)}</span>
      <span class="session-time">${appt.time || ''}</span>
    </div>
  `).join('');

  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>KAREH - Ticket 48mm</title>
        <style>
          /* CONFIGURACIÓN PARA IMPRESORA TÉRMICA 48MM */
          @page {
            size: ${THERMAL_WIDTH_SAFE()}mm auto;
            margin: 0;
            padding: 0;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            width: ${THERMAL_WIDTH_SAFE()}mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: "Courier New", "Courier", monospace;
          }

          body {
            padding: 2.75mm;
          }

          .ticket {
            width: 100%;
            font-size: 14px;
            line-height: 1.6;
          }

          /* HEADER - TITULO PRINCIPAL */
          .header {
            text-align: center;
            margin-bottom: 3.5mm;
            border-bottom: 2px solid #000;
            padding-bottom: 2.2mm;
          }

          .title {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: 1.2px;
            margin-bottom: 0;
            line-height: 1;
          }

          .center {
            text-align: center;
          }

          .divider {
            border-top: 1px solid #000;
            margin: 2mm 0;
            height: 0;
          }

          .divider-dashed {
            border-top: 1px dashed #000;
            margin: 1.5mm 0;
            height: 0;
          }

          /* SECCIÓN PACIENTE */
          .section {
            margin-bottom: 2.3mm;
          }

          .section-title {
            font-size: 14px;
            font-weight: 900;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 1mm;
            border-bottom: 1px solid #000;
            padding-bottom: 0.5mm;
          }

          .patient-name {
            font-size: 16px;
            font-weight: 900;
            text-align: center;
            word-break: break-word;
            margin-bottom: 1mm;
            text-transform: uppercase;
          }

          /* DATOS DE COBERTURA */
          .meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5mm;
            margin-bottom: 1.2mm;
            font-size: 14px;
          }

          .meta-item {
            padding: 0.5mm 0;
          }

          .meta-item-full {
            grid-column: 1 / -1;
          }

          .meta-label {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            display: block;
          }

          .meta-value {
            font-size: 14.5px;
            font-weight: 900;
            word-break: break-word;
            display: block;
          }

          /* BANDERAS DE SALUD */
          .flags {
            display: flex;
            justify-content: space-around;
            gap: 1.5mm;
            margin: 1.2mm 0;
            padding: 1.2mm 0.8mm;
            border: 1px solid #000;
            border-radius: 1px;
          }

          .flag {
            font-size: 13.5px;
            font-weight: 900;
            text-transform: uppercase;
            flex: 1;
            text-align: center;
          }

          /* DIAGNÓSTICO */
          .diagnosis {
            font-size: 15px;
            font-weight: 900;
            text-align: center;
            word-break: break-word;
            text-transform: uppercase;
            margin-bottom: 1mm;
          }

          /* SESIONES */
          .summary {
            font-size: 15px;
            font-weight: 900;
            text-align: center;
            text-transform: uppercase;
            margin: 1mm 0;
          }

          .chronogram {
            margin-bottom: 1.5mm;
          }

          .row {
            display: grid;
            grid-template-columns: 22px 1fr 74px;
            gap: 5px;
            align-items: center;
            font-size: 14px;
            width: 100%;
            margin-bottom: 0.6mm;
          }

          .session-row {
            border-bottom: 1px dotted #000;
            padding: 0.5mm 0;
          }

          .session-index {
            font-weight: 900;
            text-align: left;
          }

          .session-date {
            font-weight: 900;
            text-align: center;
          }

          .session-time {
            font-weight: 900;
            text-align: right;
            white-space: nowrap;
          }

          /* POLÍTICA Y FOOTER */
          .policy {
            font-size: 13px;
            font-weight: 900;
            text-align: center;
            line-height: 1.55;
            margin-bottom: 1.5mm;
            padding: 1mm 0;
            white-space: pre-line;
          }

          .footer {
            text-align: center;
            font-size: 12.5px;
            margin-top: 1.2mm;
            padding-top: 1.2mm;
            border-top: 1px solid #000;
          }

          .contact-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            margin-bottom: 0.8mm;
            font-weight: 800;
          }

          .wa-badge {
            display: inline-flex;
            width: 11px;
            height: 11px;
            flex-shrink: 0;
          }

          .wa-badge svg {
            width: 100%;
            height: 100%;
            display: block;
          }

          .contact-info {
            font-size: 12.5px;
            font-weight: 900;
            margin-bottom: 0.6mm;
          }

          .issue-date {
            font-size: 11.5px;
            font-weight: 900;
            margin-top: 0.7mm;
          }

          /* PRINT MEDIA QUERY */
          @media print {
            body {
              margin: 0;
              padding: 2.5mm;
            }
            .ticket {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <!-- HEADER -->
          <div class="header">
            <div class="title">KAREH</div>
          </div>

          <!-- PACIENTE -->
          <div class="section">
            <div class="section-title">Paciente</div>
            <div class="patient-name">${printablePatient.fullName}</div>
            
            <div class="meta">
              <div class="meta-item">
                <span class="meta-label">DNI</span>
                <span class="meta-value">${printablePatient.dni}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Edad</span>
                <span class="meta-value">${printablePatient.age || 'N/A'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">F. Nac</span>
                <span class="meta-value">${printablePatient.birthDate}</span>
              </div>
              <div class="meta-item meta-item-full">
                <span class="meta-label">Afil</span>
                <span class="meta-value">${printablePatient.affiliateNumber}</span>
              </div>
            </div>

            <div class="flags">
              <span class="flag">${printablePatient.hasCancer ? '✓ONCO' : 'ONCO'}</span>
              <span class="flag">${printablePatient.hasMarcapasos ? '✓MCP' : 'MCP'}</span>
              <span class="flag">${printablePatient.usesEA ? '✓EA' : 'EA'}</span>
            </div>
          </div>

          <!-- COBERTURA -->
          <div class="divider"></div>
          <div style="font-size: 15px; font-weight: 900; text-align: center; margin: 1.2mm 0; text-transform: uppercase;">
            ${printablePatient.healthInsurance}
          </div>

          <!-- DIAGNÓSTICO -->
          <div class="divider"></div>
          <div class="section">
            <div class="section-title">Diagnóstico</div>
            <div class="diagnosis">${printableDiagnosis}</div>
          </div>

          <!-- CRONOGRAMA -->
          <div class="divider"></div>
          <div class="section">
            <div class="summary">${sortedAppointments.length} Sesiones</div>
            <div class="section-title">Cronograma</div>
            <div class="chronogram">
              ${appointmentRows}
            </div>
          </div>

          <!-- POLÍTICA Y CONTACTO -->
          <div class="divider"></div>
          <div class="policy">${policyText}</div>

          <div class="divider-dashed"></div>

          <div class="footer">
            <div class="contact-row">
              ${buildWhatsappBadgeMarkup()}<span class="contact-info">${CONTACT_PHONE}</span>
            </div>
            <div class="contact-info">${CONTACT_ADDRESS}</div>
            <div class="issue-date">Emitido: ${toIssueDate()}</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const THERMAL_WIDTH_SAFE = () => THERMAL_WIDTH_MM.toString().replace(',', '.');

const WhatsAppBadge = () => (
  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-[8px] font-black text-white">
    WA
  </span>
);

const PrintSessions = ({ isOpen, onClose, appointments, patientData, diagnosis, appointmentId }) => {
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const ticketRef = useRef(null);

  if (!isOpen || !appointments || appointments.length === 0) return null;

  const getPatientFullName = () => {
    if (patientData?.fullName?.trim()) return patientData.fullName.trim().toUpperCase();

    const composedName = [patientData?.lastName, patientData?.firstName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return composedName ? composedName.toUpperCase() : 'N/A';
  };

  const formatBirthDate = (value) => {
    const date = parseTicketDate(value);
    if (!date) return 'N/A';
    const dateString = format(date, 'yyyy-MM-dd');
    if (dateString <= UNKNOWN_BIRTHDATE) return 'N/A';
    return format(date, 'dd/MM/yyyy', { locale: es });
  };

  const calculateAge = (birthDate) => {
    const date = parseTicketDate(birthDate);
    if (!date) return null;
    const dateString = format(date, 'yyyy-MM-dd');
    if (dateString <= UNKNOWN_BIRTHDATE) return null;

    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const month = today.getMonth() - date.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const printablePatient = {
    fullName: getPatientFullName(),
    dni: patientData?.dni || 'N/A',
    phone: patientData?.phone || 'N/A',
    age: calculateAge(patientData?.birthDate),
    birthDate: formatBirthDate(patientData?.birthDate),
    healthInsurance: getCoverageLabel(patientData?.healthInsurance),
    affiliateNumber: patientData?.affiliateNumber || 'N/A',
    hasCancer: !!patientData?.hasCancer,
    hasMarcapasos: !!patientData?.hasMarcapasos,
    usesEA: !!patientData?.usesEA,
  };

  const printableDiagnosis = diagnosis ? diagnosis.toUpperCase() : 'CONSULTAR HISTORIA CLINICA';
  const sortedAppointments = [...appointments].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const policyText = getPolicyText(patientData?.healthInsurance);

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=700,width=420');
    if (!printWindow) {
      alert('El navegador bloqueó la ventana de impresión.');
      return;
    }

    printWindow.document.write(buildPrintHtml({ printablePatient, printableDiagnosis, sortedAppointments, policyText }));
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    printWindow.onafterprint = () => {
      printWindow.close();
    };
  };

  const handleDownloadImage = async () => {
    if (!ticketRef.current) return;

    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.download = `ticket-${appointmentId || 'preview'}.jpg`;
      link.click();
    } catch (error) {
      alert('Error al descargar imagen: ' + error.message);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!appointmentId) {
      alert('El turno todavía no está guardado.');
      return;
    }

    try {
      setSendingWhatsApp(true);
      await api.post(`/appointments/${appointmentId}/whatsapp-ticket-document`);
      alert('✓ PDF enviado por WhatsApp exitosamente');
      onClose();
    } catch (error) {
      console.error('Error al enviar PDF por WhatsApp:', error);
      const serverMessage = error?.response?.data?.message;
      const serverDetail = error?.response?.data?.detail;
      alert(
        serverMessage
          ? `${serverMessage}${serverDetail ? `\nDetalle: ${serverDetail}` : ''}`
          : `Error: ${error?.message || 'No se pudo enviar el PDF por WhatsApp'}`
      );
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '0.75rem', backdropFilter: 'blur(4px)', overflowY: 'auto' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '2.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '44rem', maxHeight: 'calc(100vh - 1.5rem)', margin: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
        <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)', borderBottom: '1px solid #000000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(15, 23, 42, 0.05)', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#000000', marginBottom: '0.25rem' }}>Vista Previa Térmica</h2>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em' }}>48 mm • 32 caracteres</p>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '9999px', transition: 'all 200ms' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#e2e8f0'} onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
            <X size={20} color="#000000" />
          </button>
        </div>

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 'clamp(1rem, 3vw, 1.5rem)', backgroundColor: 'rgba(15, 23, 42, 0.05)' }}>
          <div
            ref={ticketRef}
            style={{ margin: '0 auto', backgroundColor: '#ffffff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', borderRadius: '0.5rem', border: '1px solid #cbd5e1', padding: 'clamp(1rem, 4vw, 1.5rem)', color: '#000000', fontSize: PREVIEW_BODY_TEXT_SIZE, width: '100%', maxWidth: `${THERMAL_PREVIEW_WIDTH_PX}px`, fontFamily: '"Courier New", monospace', lineHeight: 1.65, overflowWrap: 'anywhere' }}
          >
            {/* HEADER */}
            <div style={{ textAlign: 'center', marginBottom: '0.9rem', paddingBottom: '0.9rem', borderBottom: '2px solid #000000' }}>
              <h1 style={{ fontSize: '44px', fontWeight: 900, lineHeight: 1, color: '#000000' }}>KAREH</h1>
            </div>

            {/* PACIENTE */}
            <div style={{ marginBottom: '0.7rem' }}>
              <p style={{ textAlign: 'center', fontSize: PREVIEW_SECTION_TEXT_SIZE, fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.4rem', color: '#000000' }}>PACIENTE:</p>
              <p style={{ textAlign: 'center', fontSize: PREVIEW_NAME_TEXT_SIZE, fontWeight: 900, textTransform: 'uppercase', wordBreak: 'break-word', color: '#000000', lineHeight: 1.15 }}>{printablePatient.fullName}</p>
            </div>

            {/* META DATOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.9rem', fontSize: PREVIEW_BODY_TEXT_SIZE, fontWeight: 900, color: '#000000' }}>
              <div>
                <span style={{ fontWeight: 900 }}>DNI:</span>
                <span> {printablePatient.dni}</span>
              </div>
              <div>
                <span style={{ fontWeight: 900 }}>EDAD:</span>
                <span> {printablePatient.age || 'N/A'}</span>
              </div>
              <div>
                <span style={{ fontWeight: 900 }}>F.NAC:</span>
                <span> {printablePatient.birthDate}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontWeight: 900 }}>AFIL:</span>
                <span> {printablePatient.affiliateNumber}</span>
              </div>
            </div>

            {/* BANDERAS */}
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '0.6rem', margin: '0.9rem 0', padding: '0.55rem 0.8rem', border: '2px solid #000000', borderRadius: '2px', fontSize: PREVIEW_BODY_TEXT_SIZE, fontWeight: 900, color: '#000000' }}>
              <span>{printablePatient.hasCancer ? '✓ONCO' : 'ONCO'}</span>
              <span>{printablePatient.hasMarcapasos ? '✓MCP' : 'MCP'}</span>
              <span>{printablePatient.usesEA ? '✓EA' : 'EA'}</span>
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px solid #000000', margin: '0.75rem 0', height: 0 }} />

            {/* COBERTURA */}
            <div style={{ textAlign: 'center', fontSize: PREVIEW_SECTION_TEXT_SIZE, fontWeight: 900, marginBottom: '0.85rem', textTransform: 'uppercase', color: '#000000', lineHeight: 1.2 }}>
              {printablePatient.healthInsurance}
            </div>

            {/* DIAGNÓSTICO */}
            <div style={{ marginBottom: '0.7rem' }}>
              <p style={{ textAlign: 'center', fontSize: PREVIEW_SECTION_TEXT_SIZE, fontWeight: 900, marginBottom: '0.4rem', textTransform: 'uppercase', color: '#000000' }}>DIAG:</p>
              <p style={{ textAlign: 'center', fontSize: PREVIEW_SECTION_TEXT_SIZE, fontWeight: 900, wordBreak: 'break-word', textTransform: 'uppercase', color: '#000000', lineHeight: 1.2 }}>{printableDiagnosis}</p>
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px solid #000000', margin: '0.75rem 0', height: 0 }} />

            {/* SESIONES */}
            <div style={{ textAlign: 'center', fontSize: PREVIEW_SECTION_TEXT_SIZE, fontWeight: 900, marginBottom: '0.75rem', textTransform: 'uppercase', color: '#000000' }}>
              {sortedAppointments.length} SESIONES
            </div>

            <p style={{ textAlign: 'center', fontSize: PREVIEW_SECTION_TEXT_SIZE, fontWeight: 900, marginBottom: '0.45rem', textTransform: 'uppercase', color: '#000000' }}>CRONOGRAMA:</p>
            <div style={{ marginBottom: '0.9rem' }}>
              {sortedAppointments.map((appt, idx) => (
                <div key={`${appt.id || idx}-${appt.time}`} style={{ display: 'grid', gridTemplateColumns: '2.5rem minmax(0, 1fr) auto', gap: '0.7rem', borderBottom: '1px dotted #000000', padding: '0.55rem 0', fontSize: PREVIEW_BODY_TEXT_SIZE, fontWeight: 900, color: '#000000', alignItems: 'center' }}>
                  <span style={{ flexShrink: 0, textAlign: 'right', fontWeight: 900 }}>{appt.sessionNumber || idx + 1}.</span>
                  <span style={{ minWidth: 0, fontWeight: 900 }}>{toThermalDate(appt.date)}</span>
                  <span style={{ flexShrink: 0, fontWeight: 900 }}>{appt.time || ''}</span>
                </div>
              ))}
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px solid #000000', margin: '0.75rem 0', height: 0 }} />

            {/* POLÍTICA */}
            <div style={{ textAlign: 'center', fontSize: PREVIEW_POLICY_TEXT_SIZE, fontWeight: 900, lineHeight: 1.6, marginBottom: '0.9rem', padding: '0.45rem 0', color: '#000000', whiteSpace: 'pre-line' }}>
              {policyText}
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px dashed #000000', margin: '0.75rem 0', height: 0 }} />

            {/* FOOTER */}
            <div style={{ marginTop: '0.9rem', paddingTop: '0.9rem', textAlign: 'center', fontSize: PREVIEW_FOOTER_TEXT_SIZE, fontWeight: 900, color: '#000000' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <WhatsAppBadge />
                <span style={{ fontWeight: 900 }}>{CONTACT_PHONE}</span>
              </div>
              <div style={{ fontSize: PREVIEW_FOOTER_TEXT_SIZE, fontWeight: 900, lineHeight: 1.3 }}>{CONTACT_ADDRESS}</div>
              <div style={{ fontSize: 'clamp(0.95rem, 3.4vw, 1.2rem)', fontWeight: 900, marginTop: '0.5rem' }}>Emitido: {toIssueDate()}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)', borderTop: '1px solid #000000', backgroundColor: '#ffffff', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '0.875rem 1.5rem', fontWeight: 800, color: '#4b5563', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '1rem', cursor: 'pointer', transition: 'all 200ms', minHeight: '3.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 10rem' }} onMouseEnter={(e) => { e.target.style.color = '#0f172a'; e.target.style.backgroundColor = '#e2e8f0'; }} onMouseLeave={(e) => { e.target.style.color = '#4b5563'; e.target.style.backgroundColor = '#f8fafc'; }}>
            Cerrar
          </button>
          <button
            onClick={handleDownloadImage}
            disabled={sendingWhatsApp}
            style={{ padding: '0.875rem 1.5rem', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, borderRadius: '1rem', border: 'none', cursor: sendingWhatsApp ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 20px 25px -5px rgba(37, 99, 235, 0.1)', opacity: sendingWhatsApp ? 0.6 : 1, transition: 'all 200ms', minHeight: '3.25rem', flex: '1 1 12rem' }}
            onMouseEnter={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#1d4ed8')}
            onMouseLeave={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#2563eb')}
          >
            <Download size={18} /> Descargar
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={sendingWhatsApp}
            style={{ padding: '0.875rem 1.5rem', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 900, borderRadius: '1rem', border: 'none', cursor: sendingWhatsApp ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2)', opacity: sendingWhatsApp ? 0.6 : 1, transition: 'all 200ms', minHeight: '3.25rem', flex: '1 1 16rem' }}
            onMouseEnter={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#0d3b66')}
            onMouseLeave={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#0f172a')}
          >
            {sendingWhatsApp ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
            {sendingWhatsApp ? 'Enviando PDF...' : 'Enviar PDF por WhatsApp'}
          </button>
          <button
            onClick={handlePrint}
            style={{ padding: '0.875rem 1.5rem', backgroundColor: '#0d9488', color: '#ffffff', fontWeight: 900, borderRadius: '1rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 20px 25px -5px rgba(13, 148, 136, 0.1)', transition: 'all 200ms', minHeight: '3.25rem', flex: '1 1 12rem' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#0f766e'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#0d9488'}
          >
            <Printer size={18} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintSessions;
