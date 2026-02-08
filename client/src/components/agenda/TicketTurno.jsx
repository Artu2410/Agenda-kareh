import React from 'react';
import { Printer, X, Calendar, Clock, User, AlertTriangle } from 'lucide-react';

const TicketTurno = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[200] p-4 sm:p-6 no-print">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md h-auto max-h-[90vh] overflow-hidden flex flex-col">
        {/* Vista previa en pantalla */}
        <div className="p-4 sm:p-6 space-y-4 text-center overflow-y-auto">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-teal-100 p-2 rounded-full text-teal-600">
              <Printer size={20} />
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
          
          <h3 className="text-lg sm:text-xl font-black text-slate-800">¡Turno Agendado!</h3>
          <p className="text-sm text-slate-500">¿Deseas imprimir el comprobante para el paciente?</p>

          {/* Diseño del Ticket (Lo que se imprime) */}
          <div id="ticket-imprimible" className="border-2 border-dashed border-slate-200 p-4 sm:p-6 rounded-xl bg-slate-50 text-left space-y-3 print:border-none print:bg-white print:p-0 text-sm sm:text-base">
            <div className="text-center border-b pb-2 mb-2">
              <h2 className="font-black text-xl sm:text-2xl text-teal-700">KAREH PRO</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold">Centro de Rehabilitación</p>
            </div>

            <div className="space-y-2 text-sm sm:text-base">
              <div className="flex items-center gap-2">
                <User size={16} className="text-slate-400 flex-shrink-0" />
                <span className="font-bold">{data.patientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400 flex-shrink-0" />
                <span>{data.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400 flex-shrink-0" />
                <span className="font-bold">{data.time} hs</span>
              </div>
            </div>

            <div className="mt-4 p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-100 print:border-slate-300 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <AlertTriangle size={16} />
                <span className="text-[10px] font-black uppercase">Aviso Importante</span>
              </div>
              <p className="text-[11px] sm:text-[12px] text-amber-800 leading-tight">
                Para recuperar o cancelar sesiones, deberá avisar con un mínimo de <b>24 horas de anticipación</b>. Caso contrario, la sesión se dará por perdida.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={onClose} className="py-2 sm:py-3 font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 text-sm sm:text-base">Cerrar</button>
            <button onClick={handlePrint} className="py-2 sm:py-3 font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-100 flex items-center justify-center gap-2 text-sm sm:text-base">
              <Printer size={18}/> Imprimir
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #ticket-imprimible, #ticket-imprimible * {
            visibility: visible;
          }
          #ticket-imprimible {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default TicketTurno;