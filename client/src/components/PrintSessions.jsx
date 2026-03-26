import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Printer, Download, Loader2, Send } from 'lucide-react';
import html2canvas from 'html2canvas';
import api from '@/services/api';

const UNKNOWN_BIRTHDATE = '1900-01-01';
const THERMAL_WIDTH_MM = 48; // 48mm = 32 caracteres por línea (fuente monoespaciada)
const THERMAL_PREVIEW_WIDTH_PX = 350; // Aumentado de 184px a 350px para mejor legibilidad
const CONTACT_PHONE = '+54 9 11 3201-6039';
const CONTACT_ADDRESS = 'Av. Senador Morón 782';
const WHATSAPP_POLICY_TEXT = 'Solo se pueden recuperar 2 sesiones avisando con 24 hs de anticipación por WhatsApp.';
const INSTAGRAM_HANDLE = '@centro.kareh';
const FACEBOOK_HANDLE = 'Centro Kareh';

const buildWhatsappBadgeMarkup = () => `
  <span class="wa-badge" aria-hidden="true">
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <text x="16" y="21" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">WA</text>
    </svg>
  </span>
`;

const toThermalDate = (value) => {
  if (!value) return 'N/A';

  let date;
  if (String(value).includes('T')) {
    date = new Date(value);
  } else {
    const [year, month, day] = String(value).split('-').map(Number);
    date = new Date(year, month - 1, day, 12, 0, 0);
  }

  if (Number.isNaN(date.getTime())) return 'N/A';

  return format(date, 'EEE dd/MM', { locale: es }).replace('.', '').toUpperCase();
};

const toIssueDate = () => format(new Date(), "d 'de' MMMM, yyyy", { locale: es });

const buildPrintHtml = ({ printablePatient, printableDiagnosis, sortedAppointments }) => {
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
            padding: 2.5mm;
          }

          .ticket {
            width: 100%;
            font-size: 9px;
            line-height: 1.3;
          }

          /* HEADER - TITULO PRINCIPAL */
          .header {
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 2px solid #000;
            padding-bottom: 2mm;
          }

          .title {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 1px;
            margin-bottom: 0;
            line-height: 1;
          }

          .subtitle {
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-top: 1mm;
            text-transform: uppercase;
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
            margin-bottom: 2mm;
          }

          .section-title {
            font-size: 8px;
            font-weight: 900;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 1mm;
            border-bottom: 1px solid #000;
            padding-bottom: 0.5mm;
          }

          .patient-name {
            font-size: 11px;
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
            gap: 1mm;
            margin-bottom: 1mm;
            font-size: 8px;
          }

          .meta-item {
            padding: 0.5mm 0;
          }

          .meta-label {
            font-size: 7px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            display: block;
          }

          .meta-value {
            font-size: 8px;
            font-weight: 700;
            word-break: break-word;
            display: block;
          }

          /* BANDERAS DE SALUD */
          .flags {
            display: flex;
            justify-content: space-around;
            gap: 1mm;
            margin: 1mm 0;
            padding: 0.5mm 0;
            border: 1px solid #000;
            border-radius: 1px;
          }

          .flag {
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
            flex: 1;
            text-align: center;
          }

          /* DIAGNÓSTICO */
          .diagnosis {
            font-size: 9px;
            font-weight: 700;
            text-align: center;
            word-break: break-word;
            text-transform: uppercase;
            margin-bottom: 1mm;
          }

          /* SESIONES */
          .summary {
            font-size: 9px;
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
            grid-template-columns: 12px 1fr 40px;
            gap: 2px;
            align-items: center;
            font-size: 8px;
            width: 100%;
            margin-bottom: 0.5mm;
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
            font-weight: 700;
            text-align: center;
          }

          .session-time {
            font-weight: 700;
            text-align: right;
            white-space: nowrap;
          }

          /* POLÍTICA Y FOOTER */
          .policy {
            font-size: 7px;
            font-weight: 700;
            text-align: center;
            line-height: 1.3;
            margin-bottom: 1mm;
            padding: 0.5mm 0;
          }

          .footer {
            text-align: center;
            font-size: 7px;
            margin-top: 1mm;
            padding-top: 1mm;
            border-top: 1px solid #000;
          }

          .contact-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2px;
            margin-bottom: 0.5mm;
            font-weight: 700;
          }

          .wa-badge {
            display: inline-flex;
            width: 9px;
            height: 9px;
            flex-shrink: 0;
          }

          .wa-badge svg {
            width: 100%;
            height: 100%;
            display: block;
          }

          .contact-info {
            font-weight: 700;
            margin-bottom: 0.5mm;
          }

          .social {
            font-size: 6px;
            margin-bottom: 0.3mm;
          }

          .issue-date {
            font-size: 6px;
            font-weight: 700;
            margin-top: 0.5mm;
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
            <div class="subtitle">Rehabilitación y Bienestar</div>
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
              <div class="meta-item">
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
          <div style="font-size: 8px; font-weight: 700; text-align: center; margin: 1mm 0; text-transform: uppercase;">
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
          <div class="policy">${WHATSAPP_POLICY_TEXT}</div>

          <div class="divider-dashed"></div>

          <div class="footer">
            <div class="contact-row">
              ${buildWhatsappBadgeMarkup()}<span class="contact-info">${CONTACT_PHONE}</span>
            </div>
            <div class="contact-info">${CONTACT_ADDRESS}</div>
            <div class="social">IG: ${INSTAGRAM_HANDLE}</div>
            <div class="social">FB: ${FACEBOOK_HANDLE}</div>
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
    if (!value) return 'N/A';
    const dateString = value.includes?.('T') ? value.split('T')[0] : value;
    if (dateString <= UNKNOWN_BIRTHDATE) return 'N/A';

    const date = value.includes?.('T')
      ? new Date(value)
      : new Date(`${value}T12:00:00`);

    return Number.isNaN(date.getTime())
      ? 'N/A'
      : format(date, 'dd/MM/yyyy', { locale: es });
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const dateString = birthDate.includes?.('T') ? birthDate.split('T')[0] : birthDate;
    if (dateString <= UNKNOWN_BIRTHDATE) return null;

    const date = birthDate.includes?.('T')
      ? new Date(birthDate)
      : new Date(`${dateString}T12:00:00`);

    if (Number.isNaN(date.getTime())) return null;

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
    healthInsurance: patientData?.healthInsurance?.toUpperCase() || 'PARTICULAR',
    affiliateNumber: patientData?.affiliateNumber || 'N/A',
    hasCancer: !!patientData?.hasCancer,
    hasMarcapasos: !!patientData?.hasMarcapasos,
    usesEA: !!patientData?.usesEA,
  };

  const printableDiagnosis = diagnosis ? diagnosis.toUpperCase() : 'CONSULTAR HISTORIA CLINICA';
  const sortedAppointments = [...appointments].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=700,width=420');
    if (!printWindow) {
      alert('El navegador bloqueó la ventana de impresión.');
      return;
    }

    printWindow.document.write(buildPrintHtml({ printablePatient, printableDiagnosis, sortedAppointments }));
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    printWindow.onafterprint = () => {
      printWindow.close();
    };
  };

  const ticketRef = useRef(null);

  const handleCaptureImage = async () => {
    if (!ticketRef.current) {
      alert('Error al acceder al ticket');
      return;
    }

    try {
      setSendingWhatsApp(true);
      
      // Capturar el ticket como imagen con html2canvas
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Convertir canvas a blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      
      // Crear FormData con la imagen
      const formData = new FormData();
      formData.append('image', blob, `ticket-${appointmentId}.jpg`);
      formData.append('appointmentId', appointmentId);

      // Enviar al servidor
      await api.post('/appointments/whatsapp-ticket-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('✓ Ticket enviado por WhatsApp exitosamente');
      onClose();
    } catch (error) {
      console.error('Error al capturar/enviar imagen:', error);
      alert('Error: ' + (error?.response?.data?.message || error.message));
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!ticketRef.current) return;

    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
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
    
    await handleCaptureImage();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '1rem', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '2.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '32rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #000000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.05)' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#000000', marginBottom: '0.25rem' }}>Vista Previa Térmica</h2>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em' }}>48 mm • 32 caracteres</p>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '9999px', transition: 'all 200ms' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#e2e8f0'} onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
            <X size={20} color="#000000" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'rgba(15, 23, 42, 0.05)' }}>
          <div
            ref={ticketRef}
            style={{ margin: '0 auto', backgroundColor: '#ffffff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', borderRadius: '0.5rem', border: '1px solid #cbd5e1', padding: '1rem', color: '#000000', fontSize: '12px', width: `${THERMAL_PREVIEW_WIDTH_PX}px`, fontFamily: '"Courier New", monospace', lineHeight: 1.4 }}
          >
            {/* HEADER */}
            <div style={{ textAlign: 'center', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '2px solid #000000' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1, color: '#000000' }}>KAREH</h1>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: '#000000' }}>REHABILITACIÓN</p>
            </div>

            {/* PACIENTE */}
            <div style={{ marginBottom: '0.5rem' }}>
              <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem', color: '#000000' }}>PACIENTE:</p>
              <p style={{ textAlign: 'center', fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', wordBreak: 'break-word', color: '#000000' }}>{printablePatient.fullName}</p>
            </div>

            {/* META DATOS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '16px', fontWeight: 700, color: '#000000' }}>
              <div>
                <span style={{ fontWeight: 800 }}>DNI:</span>
                <span> {printablePatient.dni}</span>
              </div>
              <div>
                <span style={{ fontWeight: 800 }}>EDAD:</span>
                <span> {printablePatient.age || 'N/A'}</span>
              </div>
              <div>
                <span style={{ fontWeight: 800 }}>F.NAC:</span>
                <span> {printablePatient.birthDate}</span>
              </div>
              <div>
                <span style={{ fontWeight: 800 }}>AFIL:</span>
                <span> {printablePatient.affiliateNumber}</span>
              </div>
            </div>

            {/* BANDERAS */}
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '0.5rem', margin: '0.5rem 0', padding: '0.25rem 0.5rem', border: '2px solid #000000', borderRadius: '2px', fontSize: '16px', fontWeight: 800, color: '#000000' }}>
              <span>{printablePatient.hasCancer ? '✓ONCO' : 'ONCO'}</span>
              <span>{printablePatient.hasMarcapasos ? '✓MCP' : 'MCP'}</span>
              <span>{printablePatient.usesEA ? '✓EA' : 'EA'}</span>
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px solid #000000', margin: '0.5rem 0', height: 0 }} />

            {/* COBERTURA */}
            <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase', color: '#000000' }}>
              {printablePatient.healthInsurance}
            </div>

            {/* DIAGNÓSTICO */}
            <div style={{ marginBottom: '0.5rem' }}>
              <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 800, marginBottom: '0.25rem', textTransform: 'uppercase', color: '#000000' }}>DIAG:</p>
              <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 800, wordBreak: 'break-word', textTransform: 'uppercase', color: '#000000' }}>{printableDiagnosis}</p>
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px solid #000000', margin: '0.5rem 0', height: 0 }} />

            {/* SESIONES */}
            <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase', color: '#000000' }}>
              {sortedAppointments.length} SESIONES
            </div>

            <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 800, marginBottom: '0.25rem', textTransform: 'uppercase', color: '#000000' }}>CRONOGRAMA:</p>
            <div style={{ marginBottom: '0.5rem' }}>
              {sortedAppointments.map((appt, idx) => (
                <div key={`${appt.id || idx}-${appt.time}`} style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px dotted #000000', padding: '0.25rem 0', fontSize: '16px', fontWeight: 700, color: '#000000' }}>
                  <span style={{ width: '1rem', flexShrink: 0, textAlign: 'right', fontWeight: 800 }}>{appt.sessionNumber || idx + 1}.</span>
                  <span style={{ flex: 1, fontWeight: 800 }}>{toThermalDate(appt.date)}</span>
                  <span style={{ flexShrink: 0, fontWeight: 800 }}>{appt.time || ''}</span>
                </div>
              ))}
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px solid #000000', margin: '0.5rem 0', height: 0 }} />

            {/* POLÍTICA */}
            <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 700, lineHeight: 1.4, marginBottom: '0.5rem', padding: '0.25rem 0', color: '#000000' }}>
              {WHATSAPP_POLICY_TEXT}
            </div>

            {/* DIVIDER */}
            <div style={{ borderTop: '1px dashed #000000', margin: '0.5rem 0', height: 0 }} />

            {/* FOOTER */}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#000000' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                <WhatsAppBadge />
                <span style={{ fontWeight: 800 }}>{CONTACT_PHONE}</span>
              </div>
              <div style={{ fontWeight: 700 }}>{CONTACT_ADDRESS}</div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>IG: {INSTAGRAM_HANDLE.replace('@', '')}</div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>FB: {FACEBOOK_HANDLE}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '0.25rem' }}>Emitido: {toIssueDate()}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem', borderTop: '1px solid #000000', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.5rem', fontWeight: 700, color: '#9ca3af', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 200ms' }} onMouseEnter={(e) => e.target.style.color = '#4b5563'} onMouseLeave={(e) => e.target.style.color = '#9ca3af'}>
            Cerrar
          </button>
          <button
            onClick={handleDownloadImage}
            disabled={sendingWhatsApp}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, borderRadius: '1rem', border: 'none', cursor: sendingWhatsApp ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 20px 25px -5px rgba(37, 99, 235, 0.1)', opacity: sendingWhatsApp ? 0.6 : 1, transition: 'all 200ms' }}
            onMouseEnter={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#1d4ed8')}
            onMouseLeave={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#2563eb')}
          >
            <Download size={18} /> Descargar
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={sendingWhatsApp}
            style={{ padding: '0.75rem 2rem', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 900, borderRadius: '1rem', border: 'none', cursor: sendingWhatsApp ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2)', opacity: sendingWhatsApp ? 0.6 : 1, transition: 'all 200ms' }}
            onMouseEnter={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#0d3b66')}
            onMouseLeave={(e) => !sendingWhatsApp && (e.target.style.backgroundColor = '#0f172a')}
          >
            {sendingWhatsApp ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
            {sendingWhatsApp ? 'Enviando...' : 'Enviar WhatsApp'}
          </button>
          <button
            onClick={handlePrint}
            style={{ padding: '0.75rem 2rem', backgroundColor: '#0d9488', color: '#ffffff', fontWeight: 900, borderRadius: '1rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 20px 25px -5px rgba(13, 148, 136, 0.1)', transition: 'all 200ms' }}
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
