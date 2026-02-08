import React, { useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Printer } from 'lucide-react';

const PrintSessions = ({ isOpen, onClose, appointments, patientData, diagnosis }) => {
  const printRef = useRef();

  if (!isOpen || !appointments || appointments.length === 0) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=700,width=850');
    const content = printRef.current.innerHTML;

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

            .footer-info { margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            .contact-label { color: #0d9488; font-weight: bold; font-size: 9px; text-transform: uppercase; display: block; margin-bottom: 3px; }
            
            @media print {
              body { padding: 10px; }
              .diagnosis-box { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const formatearFechaTicket = (fechaString) => {
    if (!fechaString) return 'N/A';
    
    let fechaLocal;
    if (fechaString.includes('T')) {
        fechaLocal = new Date(fechaString);
    } else {
        const [year, month, day] = fechaString.split('-').map(Number);
        fechaLocal = new Date(year, month - 1, day, 12, 0, 0);
    }

    return format(fechaLocal, "EEEE dd 'de' MMMM, yyyy", { locale: es }).toUpperCase();
  };

  const sortedAppointments = [...appointments].sort((a, b) => a.date.localeCompare(b.date));

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
              <div className="data-value">{patientData?.fullName || 'N/A'}</div>

              {/* ✅ DIAGNÓSTICO: SE MOSTRARÁ SI EXISTE LA PROP */}
              <div className="diagnosis-box">
                <div className="section-label" style={{ color: '#0d9488' }}>Diagnóstico / Motivo</div>
                <div className="diagnosis-text">
                  {diagnosis ? diagnosis.toUpperCase() : "CONSULTAR HISTORIA CLÍNICA"}
                </div>
              </div>

              <div className="alert-box">
                <div className="alert-item" style={{color: patientData?.hasCancer ? '#e11d48' : '#94a3b8'}}>
                  <span>{patientData?.hasCancer ? '✔' : '▢'}</span> Oncológico
                </div>
                <div className="alert-item" style={{color: patientData?.hasMarcapasos ? '#2563eb' : '#94a3b8'}}>
                  <span>{patientData?.hasMarcapasos ? '✔' : '▢'}</span> Marcapasos
                </div>
                <div className="alert-item" style={{color: patientData?.hasEA ? '#d97706' : '#94a3b8'}}>
                  <span>{patientData?.hasEA ? '✔' : '▢'}</span> EA
                </div>
              </div>

              <div style={{display: 'flex', gap: '30px', marginTop: '10px'}}>
                <div>
                  <div className="section-label">DNI</div>
                  <div className="data-value" style={{fontSize: '12px'}}>{patientData?.dni || 'N/A'}</div>
                </div>
                <div>
                  <div className="section-label">Cobertura</div>
                  <div className="data-value" style={{fontSize: '12px'}}>{patientData?.healthInsurance?.toUpperCase() || 'PARTICULAR'}</div>
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
                  <span className="index">{idx + 1}.</span>
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