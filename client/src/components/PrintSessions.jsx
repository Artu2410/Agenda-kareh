import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Printer, Download } from 'lucide-react';
import api from '@/services/api';

const UNKNOWN_BIRTHDATE = '1900-01-01';
const THERMAL_WIDTH_MM = 48; // 48mm = 32 caracteres por línea (fuente monoespaciada)
const THERMAL_PREVIEW_WIDTH_PX = 184; // 48mm preview en pixels
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

  const handleSendWhatsApp = async () => {
    if (!appointmentId) {
      alert('El turno todavía no está guardado.');
      return;
    }
    try {
      setSendingWhatsApp(true);
      await api.post(`/appointments/${appointmentId}/whatsapp-ticket`);
      alert('Ticket enviado por WhatsApp (link).');
    } catch (error) {
      const serverMessage = error?.response?.data?.message;
      const serverDetail = error?.response?.data?.detail;
      alert(
        serverMessage
          ? `${serverMessage}${serverDetail ? `\nDetalle: ${serverDetail}` : ''}`
          : (error?.friendlyMessage || 'No se pudo enviar por WhatsApp.')
      );
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-white/20">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800">Vista Previa Térmica</h2>
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">48 mm • 32 caracteres</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
          <div
            className="mx-auto bg-white shadow-sm rounded-lg border border-slate-300 p-2 text-slate-900 text-[8px]"
            style={{ width: `${THERMAL_PREVIEW_WIDTH_PX}px`, fontFamily: '"Courier New", monospace', lineHeight: 1.25 }}
          >
            {/* HEADER */}
            <div className="text-center mb-1 pb-1 border-b-2 border-black">
              <h1 className="text-[20px] font-black leading-none">KAREH</h1>
              <p className="text-[6px] font-bold tracking-wider">REHABILITACIÓN</p>
            </div>

            {/* PACIENTE */}
            <div className="mb-1">
              <p className="text-center text-[7px] font-black uppercase mb-0.5">Paciente</p>
              <p className="text-center text-[9px] font-black uppercase break-words">{printablePatient.fullName}</p>
            </div>

            {/* META DATOS */}
            <div className="grid grid-cols-2 gap-1 mb-1 text-[7px]">
              <div>
                <span className="font-black">DNI:</span>
                <span> {printablePatient.dni}</span>
              </div>
              <div>
                <span className="font-black">EDAD:</span>
                <span> {printablePatient.age || 'N/A'}</span>
              </div>
              <div>
                <span className="font-black">F.NAC:</span>
                <span> {printablePatient.birthDate}</span>
              </div>
              <div>
                <span className="font-black">AFIL:</span>
                <span> {printablePatient.affiliateNumber}</span>
              </div>
            </div>

            {/* BANDERAS */}
            <div className="flex justify-between gap-1 mb-1 text-[6px] font-black border border-black px-1 py-0.5">
              <span>{printablePatient.hasCancer ? '✓ONCO' : 'ONCO'}</span>
              <span>{printablePatient.hasMarcapasos ? '✓MCP' : 'MCP'}</span>
              <span>{printablePatient.usesEA ? '✓EA' : 'EA'}</span>
            </div>

            {/* DIVIDER */}
            <div className="border-t border-black my-1" />

            {/* COBERTURA */}
            <div className="text-center text-[7px] font-black mb-1 uppercase">
              {printablePatient.healthInsurance}
            </div>

            {/* DIAGNÓSTICO */}
            <div className="mb-1">
              <p className="text-center text-[7px] font-black mb-0.5 uppercase">Diagnóstico</p>
              <p className="text-center text-[7px] font-bold break-words uppercase">{printableDiagnosis}</p>
            </div>

            {/* DIVIDER */}
            <div className="border-t border-black my-1" />

            {/* SESIONES */}
            <div className="text-center text-[7px] font-black mb-1 uppercase">
              {sortedAppointments.length} Sesiones
            </div>

            <p className="text-center text-[7px] font-black mb-0.5 uppercase">Cronograma</p>
            <div className="space-y-0.5 mb-1">
              {sortedAppointments.map((appt, idx) => (
                <div key={`${appt.id || idx}-${appt.time}`} className="flex gap-1 border-b border-dotted border-black py-0.5 text-[7px] font-bold">
                  <span className="w-3 shrink-0 text-right">{appt.sessionNumber || idx + 1}.</span>
                  <span className="flex-1">{toThermalDate(appt.date)}</span>
                  <span className="shrink-0">{appt.time || ''}</span>
                </div>
              ))}
            </div>

            {/* DIVIDER */}
            <div className="border-t border-black my-1" />

            {/* POLÍTICA */}
            <div className="text-center text-[6px] font-bold leading-tight mb-1">
              {WHATSAPP_POLICY_TEXT}
            </div>

            {/* DIVIDER */}
            <div className="border-t border-dashed border-black my-1" />

            {/* FOOTER */}
            <div className="space-y-0.5 text-center text-[6px] font-bold">
              <div className="flex items-center justify-center gap-0.5">
                <WhatsAppBadge />
                <span>{CONTACT_PHONE}</span>
              </div>
              <div>{CONTACT_ADDRESS}</div>
              <div>IG: {INSTAGRAM_HANDLE.replace('@', '')}</div>
              <div>FB: {FACEBOOK_HANDLE}</div>
              <div className="text-[5px]">Emitido: {toIssueDate()}</div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-400 hover:text-slate-600 transition-colors">
            Cerrar
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={sendingWhatsApp}
            className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-200"
          >
            {sendingWhatsApp ? 'Enviando...' : 'Enviar WhatsApp'}
          </button>
          <button
            onClick={handlePrint}
            className="px-8 py-3 bg-teal-600 text-white font-black rounded-2xl hover:bg-teal-700 transition-all flex items-center gap-2 shadow-xl shadow-teal-100"
          >
            <Printer size={18} /> Imprimir Ticket
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintSessions;
