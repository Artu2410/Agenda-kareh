import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Printer } from 'lucide-react';
import api from '@/services/api';

const UNKNOWN_BIRTHDATE = '1900-01-01';
const THERMAL_WIDTH_MM = 57.5;
const THERMAL_PREVIEW_WIDTH_PX = 220;
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
      <span class="session-index">${appt.sessionNumber || idx + 1}.</span>
      <span class="session-date">${toThermalDate(appt.date)}</span>
      <span class="session-time">${appt.time || ''}</span>
    </div>
  `).join('');

  return `
    <html>
      <head>
        <title>KAREH - Ticket</title>
        <style>
          @page {
            size: ${THERMAL_WIDTH_SAFE()}mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            width: ${THERMAL_WIDTH_SAFE()}mm;
            background: #ffffff;
            color: #111827;
            font-family: "Courier New", monospace;
          }

          body {
            padding: 3mm;
          }

          .ticket {
            width: 100%;
          }

          .center {
            text-align: center;
          }

          .title {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.4px;
          }

          .subtitle {
            font-size: 8px;
            margin-top: 2px;
          }

          .divider {
            border-top: 1px dashed #111827;
            margin: 8px 0;
          }

          .section-title {
            font-size: 8px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 4px;
          }

          .patient-name,
          .diagnosis,
          .summary {
            font-size: 10px;
            font-weight: 700;
            text-align: center;
            word-break: break-word;
          }

          .meta {
            margin-top: 4px;
          }

          .meta-item {
            margin-bottom: 4px;
          }

          .meta-label {
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .meta-value {
            font-size: 8px;
            word-break: break-word;
          }

          .row {
            display: flex;
            align-items: flex-start;
            gap: 4px;
            width: 100%;
          }

          .session-row {
            border-bottom: 1px dotted #cbd5e1;
            padding: 4px 0;
          }

          .session-index {
            width: 12px;
            font-size: 8px;
            font-weight: 700;
          }

          .session-date {
            flex: 1;
            font-size: 8px;
            font-weight: 700;
          }

          .session-time {
            font-size: 8px;
            font-weight: 700;
            white-space: nowrap;
          }

          .flags {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            margin-top: 4px;
          }

          .flag {
            font-size: 7px;
            font-weight: 700;
          }

          .footer {
            text-align: center;
            font-size: 7px;
            margin-top: 8px;
          }

          .policy {
            font-size: 7px;
            font-weight: 700;
            text-align: center;
            line-height: 1.4;
          }

          .contact-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            margin-bottom: 3px;
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

          .social {
            font-size: 7px;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="center">
            <div class="title">KAREH</div>
            <div class="subtitle">REHABILITACION Y BIENESTAR</div>
          </div>

          <div class="divider"></div>

          <div class="section-title">PACIENTE</div>
          <div class="patient-name">${printablePatient.fullName}</div>

          <div class="meta">
            <div class="meta-item">
              <div class="meta-label">DNI</div>
              <div class="meta-value">${printablePatient.dni}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">TELEFONO</div>
              <div class="meta-value">${printablePatient.phone}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">NACIMIENTO</div>
              <div class="meta-value">${printablePatient.birthDate}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">COBERTURA</div>
              <div class="meta-value">${printablePatient.healthInsurance}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">AFILIADO</div>
              <div class="meta-value">${printablePatient.affiliateNumber}</div>
            </div>
          </div>

          <div class="flags">
            <div class="flag">${printablePatient.hasCancer ? '[X]' : '[ ]'} ONCO</div>
            <div class="flag">${printablePatient.hasMarcapasos ? '[X]' : '[ ]'} MCP</div>
            <div class="flag">${printablePatient.usesEA ? '[X]' : '[ ]'} EA</div>
          </div>

          <div class="divider"></div>

          <div class="section-title">DIAGNOSTICO</div>
          <div class="diagnosis">${printableDiagnosis}</div>

          <div class="divider"></div>

          <div class="summary">${sortedAppointments.length} SESIONES PROGRAMADAS</div>

          <div class="divider"></div>

          <div class="section-title">CRONOGRAMA</div>
          ${appointmentRows}

          <div class="divider"></div>

          <div class="policy">${WHATSAPP_POLICY_TEXT}</div>

          <div class="divider"></div>

          <div class="footer">
            <div class="contact-row">${buildWhatsappBadgeMarkup()}<span>${CONTACT_PHONE}</span></div>
            <div>${CONTACT_ADDRESS}</div>
            <div class="social">Instagram: ${INSTAGRAM_HANDLE}</div>
            <div class="social">Facebook: ${FACEBOOK_HANDLE}</div>
            <div>Emitido el ${toIssueDate()}</div>
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

  const printablePatient = {
    fullName: getPatientFullName(),
    dni: patientData?.dni || 'N/A',
    phone: patientData?.phone || 'N/A',
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
            <h2 className="text-xl font-black text-slate-800">Vista Previa</h2>
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Formato térmico 58 mm</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
          <div
            className="mx-auto bg-white shadow-sm rounded-2xl border border-slate-200 p-3 text-slate-900"
            style={{ width: `${THERMAL_PREVIEW_WIDTH_PX}px`, fontFamily: '"Courier New", monospace' }}
          >
            <div className="text-center">
              <h1 className="text-[18px] font-black tracking-tight">KAREH</h1>
              <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500">REHABILITACION Y BIENESTAR</p>
            </div>

            <div className="my-2 border-t border-dashed border-slate-400" />

            <div className="text-center">
              <p className="text-[9px] font-black tracking-[0.22em] text-slate-500">PACIENTE</p>
              <p className="mt-1 text-[11px] font-black break-words">{printablePatient.fullName}</p>
            </div>

            <div className="mt-2 space-y-1">
              <div>
                <p className="text-[8px] font-black text-slate-500">DNI</p>
                <p className="text-[10px] font-bold break-words">{printablePatient.dni}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-500">TELEFONO</p>
                <p className="text-[10px] font-bold break-words">{printablePatient.phone}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-500">NACIMIENTO</p>
                <p className="text-[10px] font-bold break-words">{printablePatient.birthDate}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-500">COBERTURA</p>
                <p className="text-[10px] font-bold break-words">{printablePatient.healthInsurance}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-500">AFILIADO</p>
                <p className="text-[10px] font-bold break-words">{printablePatient.affiliateNumber}</p>
              </div>
            </div>

            <div className="mt-2 flex justify-between gap-2 text-[8px] font-black">
              <span>{printablePatient.hasCancer ? '[X]' : '[ ]'} ONCO</span>
              <span>{printablePatient.hasMarcapasos ? '[X]' : '[ ]'} MCP</span>
              <span>{printablePatient.usesEA ? '[X]' : '[ ]'} EA</span>
            </div>

            <div className="my-2 border-t border-dashed border-slate-400" />

            <div className="text-center">
              <p className="text-[9px] font-black tracking-[0.22em] text-slate-500">DIAGNOSTICO</p>
              <p className="mt-1 text-[10px] font-black break-words">{printableDiagnosis}</p>
            </div>

            <div className="my-2 border-t border-dashed border-slate-400" />

            <div className="text-center text-[10px] font-black">
              {sortedAppointments.length} SESIONES PROGRAMADAS
            </div>

            <div className="my-2 border-t border-dashed border-slate-400" />

            <div>
              <p className="text-center text-[9px] font-black tracking-[0.22em] text-slate-500">CRONOGRAMA</p>
              <div className="mt-1 space-y-1">
                {sortedAppointments.map((appt, idx) => (
                  <div key={`${appt.id || idx}-${appt.time}`} className="flex items-start gap-1 border-b border-dotted border-slate-200 py-1 text-[9px] font-bold">
                    <span className="w-4 shrink-0">{appt.sessionNumber || idx + 1}.</span>
                    <span className="flex-1">{toThermalDate(appt.date)}</span>
                    <span className="shrink-0">{appt.time || ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="my-2 border-t border-dashed border-slate-400" />

            <div className="text-center text-[7px] font-black leading-relaxed text-slate-700">
              {WHATSAPP_POLICY_TEXT}
            </div>

            <div className="my-2 border-t border-dashed border-slate-400" />

            <div className="space-y-1 text-center text-[8px] font-bold">
              <p className="inline-flex items-center justify-center gap-1">
                <WhatsAppBadge />
                <span>{CONTACT_PHONE}</span>
              </p>
              <p>{CONTACT_ADDRESS}</p>
              <p>Instagram: {INSTAGRAM_HANDLE}</p>
              <p>Facebook: {FACEBOOK_HANDLE}</p>
              <p>Emitido el {toIssueDate()}</p>
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
