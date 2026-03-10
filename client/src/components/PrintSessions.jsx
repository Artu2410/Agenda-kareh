import React, { useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Printer } from 'lucide-react';
import api from '@/services/api';

const PrintSessions = ({ isOpen, onClose, appointments, patientData, diagnosis, appointmentId }) => {
  const printRef = useRef();
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const UNKNOWN_BIRTHDATE = '1900-01-01';

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
      : format(date, "dd/MM/yyyy", { locale: es });
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

  function formatearFechaTicket(fechaString) {
    if (!fechaString) return 'N/A';
    
    let fechaLocal;
    if (fechaString.includes('T')) {
        fechaLocal = new Date(fechaString);
    } else {
        const [year, month, day] = fechaString.split('-').map(Number);
        fechaLocal = new Date(year, month - 1, day, 12, 0, 0);
    }

    return format(fechaLocal, "EEEE dd 'de' MMMM, yyyy", { locale: es }).toUpperCase();
  }

  const printableDiagnosis = diagnosis ? diagnosis.toUpperCase() : 'CONSULTAR HISTORIA CLINICA';
  const sortedAppointments = [...appointments].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const printableSchedule = sortedAppointments.map((appt, idx) => `
    <div class="schedule-item">
      <span class="index">${appt.sessionNumber || idx + 1}.</span>
      <span class="schedule-date">${formatearFechaTicket(appt.date)}</span>
      <span class="schedule-time">${appt.time} HS</span>
    </div>
  `).join('');

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=700,width=850');
    if (!printWindow) {
      alert('El navegador bloqueó la ventana de impresión.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>KAREH - Comprobante</title>
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 20px; }
            .title { color: #0d9488; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: -1px; }
            .subtitle { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: bold; }
            
            .section-label { font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
            .data-value { font-size: 14px; font-weight: bold; color: #1e293b; text-transform: uppercase; margin-bottom: 12px; }
            .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 30px; margin-top: 14px; }
            .patient-card { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
            
            /* Diagnóstico resaltado para impresión */
            .diagnosis-box { 
              background: #f8fafc !important; 
              border: 2px solid #0d9488 !important; 
              padding: 15px !important; 
              margin: 15px 0 !important; 
              border-radius: 12px !important; 
              display: block !important;
            }
            .diagnosis-text { font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; }

            .alert-box { display: flex; gap: 20px; margin: 15px 0; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 8px; }
            .alert-item { font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 6px; }
            
            .session-count { background: #0d9488 !important; color: white !important; text-align: center; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0; -webkit-print-color-adjust: exact; }
            
            .schedule { font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            .schedule-item { display: flex; justify-content: flex-start; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
            .index { color: #0d9488; font-weight: bold; min-width: 25px; }
            .schedule-date { font-weight: 600; }
            .schedule-time { margin-left: auto; font-weight: 800; color: #0d9488; }

            .footer-info { margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            .contact-label { color: #0d9488; font-weight: bold; font-size: 9px; text-transform: uppercase; display: block; margin-bottom: 3px; }
            
            @media print {
              body { padding: 10px; }
              .diagnosis-box { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">KAREH</h1>
            <p class="subtitle">Rehabilitación y Bienestar</p>
          </div>

          <div class="patient-section">
            <div class="section-label">Paciente</div>
            <div class="data-value">${printablePatient.fullName}</div>

            <div class="diagnosis-box">
              <div class="section-label" style="color: #0d9488;">Diagnóstico / Motivo</div>
              <div class="diagnosis-text">${printableDiagnosis}</div>
            </div>

            <div class="alert-box">
              <div class="alert-item" style="color: ${printablePatient.hasCancer ? '#e11d48' : '#94a3b8'};">
                <span>${printablePatient.hasCancer ? '✔' : '▢'}</span> Oncológico
              </div>
              <div class="alert-item" style="color: ${printablePatient.hasMarcapasos ? '#2563eb' : '#94a3b8'};">
                <span>${printablePatient.hasMarcapasos ? '✔' : '▢'}</span> Marcapasos
              </div>
              <div class="alert-item" style="color: ${printablePatient.usesEA ? '#d97706' : '#94a3b8'};">
                <span>${printablePatient.usesEA ? '✔' : '▢'}</span> EA
              </div>
            </div>

            <div class="patient-grid">
              <div class="patient-card">
                <div class="section-label">DNI</div>
                <div class="data-value" style="font-size: 12px;">${printablePatient.dni}</div>
              </div>
              <div class="patient-card">
                <div class="section-label">Teléfono</div>
                <div class="data-value" style="font-size: 12px;">${printablePatient.phone}</div>
              </div>
              <div class="patient-card">
                <div class="section-label">Cobertura</div>
                <div class="data-value" style="font-size: 12px;">${printablePatient.healthInsurance}</div>
              </div>
              <div class="patient-card">
                <div class="section-label">N° Afiliado</div>
                <div class="data-value" style="font-size: 12px;">${printablePatient.affiliateNumber}</div>
              </div>
              <div class="patient-card">
                <div class="section-label">Fecha Nacimiento</div>
                <div class="data-value" style="font-size: 12px;">${printablePatient.birthDate}</div>
              </div>
            </div>
          </div>

          <div class="session-count">
            ${sortedAppointments.length} SESIONES PROGRAMADAS
          </div>

          <div class="section-label" style="margin-bottom: 8px; text-align: center;">Cronograma de Sesiones</div>
          <div class="schedule">
            ${printableSchedule}
          </div>

          <div class="footer-info">
            <div>
              <span class="contact-label">Contacto</span>
              <strong>+54 9 11 3201-6039</strong>
            </div>
            <div style="text-align: right;">
              <span class="contact-label">Ubicación</span>
              <strong>Av. Senador Morón 782</strong>
            </div>
          </div>

          <div style="margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 10px;">
            Emitido el ${format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}
          </div>
        </body>
      </html>
    `);

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
      alert('Ticket enviado por WhatsApp.');
    } catch (error) {
      alert(error?.friendlyMessage || error?.response?.data?.message || 'No se pudo enviar por WhatsApp.');
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
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Ticket para el Paciente</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
          <div ref={printRef} className="bg-white p-8 shadow-sm rounded-2xl border border-slate-200">
            
            <div className="header">
              <h1 className="title">KAREH</h1>
              <p className="subtitle">Rehabilitación y Bienestar</p>
            </div>

            <div className="patient-section">
              <div className="section-label">Paciente</div>
              <div className="data-value">{printablePatient.fullName}</div>

              <div className="diagnosis-box">
                <div className="section-label" style={{ color: '#0d9488' }}>Diagnóstico / Motivo</div>
                <div className="diagnosis-text">
                  {printableDiagnosis}
                </div>
              </div>

              <div className="alert-box">
                <div className="alert-item" style={{color: printablePatient.hasCancer ? '#e11d48' : '#94a3b8'}}>
                  <span>{printablePatient.hasCancer ? '✔' : '▢'}</span> Oncológico
                </div>
                <div className="alert-item" style={{color: printablePatient.hasMarcapasos ? '#2563eb' : '#94a3b8'}}>
                  <span>{printablePatient.hasMarcapasos ? '✔' : '▢'}</span> Marcapasos
                </div>
                <div className="alert-item" style={{color: printablePatient.usesEA ? '#d97706' : '#94a3b8'}}>
                  <span>{printablePatient.usesEA ? '✔' : '▢'}</span> EA
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginTop: '10px'}}>
                <div style={{padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px'}}>
                  <div className="section-label">DNI</div>
                  <div className="data-value" style={{fontSize: '12px'}}>{printablePatient.dni}</div>
                </div>
                <div style={{padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px'}}>
                  <div className="section-label">Teléfono</div>
                  <div className="data-value" style={{fontSize: '12px'}}>{printablePatient.phone}</div>
                </div>
                <div style={{padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px'}}>
                  <div className="section-label">Cobertura</div>
                  <div className="data-value" style={{fontSize: '12px'}}>{printablePatient.healthInsurance}</div>
                </div>
                <div style={{padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px'}}>
                  <div className="section-label">N° Afiliado</div>
                  <div className="data-value" style={{fontSize: '12px'}}>{printablePatient.affiliateNumber}</div>
                </div>
                <div style={{padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px'}}>
                  <div className="section-label">Fecha Nacimiento</div>
                  <div className="data-value" style={{fontSize: '12px'}}>{printablePatient.birthDate}</div>
                </div>
              </div>
            </div>

            <div className="session-count">
              {sortedAppointments.length} SESIONES PROGRAMADAS
            </div>

            <div className="section-label" style={{marginBottom: '8px', textAlign: 'center'}}>Cronograma de Sesiones</div>
            <div className="schedule">
              {sortedAppointments.map((appt, idx) => (
                <div key={idx} className="schedule-item">
                  <span className="index">{appt.sessionNumber || idx + 1}.</span>
                  <span style={{fontWeight: '600'}}>{formatearFechaTicket(appt.date)}</span>
                  <span style={{marginLeft: 'auto', fontWeight: '800', color: '#0d9488'}}>{appt.time} HS</span>
                </div>
              ))}
            </div>

            <div className="footer-info">
              <div>
                <span className="contact-label">Contacto</span>
                <strong>+54 9 11 3201-6039</strong>
              </div>
              <div style={{textAlign: 'right'}}>
                <span className="contact-label">Ubicación</span>
                <strong>Av. Senador Morón 782</strong>
              </div>
            </div>

            <div style={{marginTop: '20px', fontSize: '9px', color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px'}}>
              Emitido el {format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}
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
