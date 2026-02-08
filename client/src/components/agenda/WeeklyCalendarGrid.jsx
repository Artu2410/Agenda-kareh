import React from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Zap, Plus, CheckCircle2, ClipboardList, Flag, AlertTriangle } from 'lucide-react';

const WeeklyCalendarGrid = ({ currentDate, onSlotClick, appointments }) => {
  const days = Array.from({ length: 6 }, (_, i) => addDays(currentDate, i));
  const timeSlots = [];
  for (let h = 8; h <= 20; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    timeSlots.push(`${String(h).padStart(2, '0')}:30`);
  }

  return (
    <div className="calendar-scroll-container border shadow-2xl bg-white rounded-2xl overflow-auto max-h-[85vh]">
      <div className="grid grid-cols-[60px_repeat(6,1fr)] sm:grid-cols-[85px_repeat(6,1fr)] min-w-[1000px] sm:min-w-[1250px]">
        
        {/* Encabezados y Sidebar de Hora */}
        <div className="sticky-corner border-b border-r p-2 bg-slate-100 z-50"></div>
        {days.map(day => (
          <div key={day.toString()} className="sticky-day-header p-2 sm:p-4 text-center border-b border-r bg-slate-50 z-40">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">{format(day, 'EEEE', { locale: es })}</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800">{format(day, 'd')}</p>
          </div>
        ))}

        {timeSlots.map(slotTime => (
          <React.Fragment key={slotTime}>
            <div className="sticky-time-column p-2 sm:p-4 text-center border-r border-b flex items-center justify-center min-h-[160px] bg-slate-50 z-30">
              <span className="text-[10px] sm:text-base font-black text-slate-600 italic">{slotTime}</span>
            </div>

            {days.map(day => {
              const fDate = format(day, 'yyyy-MM-dd');
              const appsInSlot = appointments.filter(a => a.date.split('T')[0] === fDate && a.time === slotTime);
              
              return (
                <div key={fDate + slotTime} className="border-b border-r p-3 bg-white group flex flex-col gap-2 relative">
                  {appsInSlot.map((app) => (
                    <div 
                      key={app.id}
                      onClick={() => onSlotClick(app)}
                      className={`group relative flex flex-col p-4 rounded-xl border-l-[8px] shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ${
                        app.patient?.usesEA ? 'bg-indigo-50 border-indigo-600' : 'bg-teal-50 border-teal-600'
                      }`}
                    >
                      {/* BADGE DE INGRESO (Si es isFirstSession) */}
                      {app.isFirstSession && (
                        <div className="absolute -top-2 -right-1 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-pulse z-10">
                          <Flag size={8} fill="currentColor" /> INGRESO
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[11px] sm:text-[13px] font-black text-slate-900 uppercase leading-tight truncate pr-4">
                          {app.patient?.fullName}
                        </span>
                        {app.status === 'COMPLETED' && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] sm:text-[10px] font-extrabold text-teal-800 bg-teal-100/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {app.patient?.healthInsurance}
                        </span>
                        {/* Muestra el número de sesión (ej: 3/10) */}
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 whitespace-nowrap">
                          SESIÓN {app.sessionNumber}
                        </span>
                      </div>

                      <div className="mt-2 sm:mt-3 p-2 bg-white/80 rounded-lg border border-slate-200/50 shadow-inner">
                        <p className="text-[10px] sm:text-[12px] font-bold text-slate-700 leading-snug line-clamp-3 uppercase">
                          {app.diagnosis || "SIN ESPECIFICAR"}
                        </p>
                      </div>

                      {/* Iconos de condición */}
                      <div className="flex gap-2 mt-3 items-center">
                        {app.patient?.hasCancer && <AlertTriangle size={12} className="text-rose-500" title="Oncológico" />}
                        {app.patient?.hasMarcapasos && <Activity size={12} className="text-blue-600 stroke-[3px]" />}
                        {app.patient?.usesEA && <Zap size={12} className="text-amber-500 fill-amber-500" />}
                      </div>
                    </div>
                  ))}
                  
                  {/* Botón para añadir si hay menos de 5 pacientes */}
                  {appsInSlot.length < 5 && (
                    <button 
                      onClick={() => onSlotClick({ date: fDate, time: slotTime })}
                      className="mt-auto w-full py-3 rounded-xl opacity-0 group-hover:opacity-100 bg-slate-50 text-slate-300 hover:text-teal-600 border-2 border-dashed border-slate-200 hover:border-teal-500 transition-all flex items-center justify-center"
                    >
                      <Plus size={28} />
                    </button>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default WeeklyCalendarGrid;