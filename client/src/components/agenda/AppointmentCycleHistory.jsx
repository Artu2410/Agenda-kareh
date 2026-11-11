import React, { useState } from 'react';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CYCLE_LENGTH = 10;

const STATUS_LABELS = {
  COMPLETED: { label: 'Asistió', classes: 'bg-emerald-100 text-emerald-700' },
  NO_SHOW: { label: 'Inasistencia', classes: 'bg-rose-100 text-rose-700' },
  SCHEDULED: { label: 'Programado', classes: 'bg-slate-100 text-slate-600' },
  PENDING_AUTHORIZATION: { label: 'Pend. autoriz.', classes: 'bg-amber-100 text-amber-700' },
  AUTHORIZED: { label: 'Autorizado', classes: 'bg-cyan-100 text-cyan-700' },
  REJECTED: { label: 'Rechazado', classes: 'bg-rose-100 text-rose-700' },
};

const CYCLE_STYLES = {
  IN_PROGRESS: { label: 'En curso', box: 'border-amber-200 bg-amber-50', badge: 'bg-amber-500 text-white' },
  COMPLETE: { label: 'Completo', box: 'border-emerald-200 bg-emerald-50', badge: 'bg-emerald-500 text-white' },
  INTERRUPTED: { label: 'Cortado', box: 'border-slate-200 bg-slate-50', badge: 'bg-slate-500 text-white' },
};

const toDay = (value) => format(new Date(value), 'dd/MM/yy', { locale: es });

const describeCycle = (cycle) => {
  if (cycle.state === 'INTERRUPTED') {
    const attendedText = cycle.attended === cycle.totalSessions
      ? ''
      : ` (${cycle.attended} asistida${cycle.attended === 1 ? '' : 's'})`;
    return `Quedó en ${cycle.totalSessions} de ${CYCLE_LENGTH} sesiones${attendedText}`;
  }
  if (cycle.state === 'COMPLETE') return `${cycle.attended} de ${cycle.totalSessions} sesiones asistidas`;
  return `${cycle.totalSessions} de ${CYCLE_LENGTH} sesiones · ${cycle.pending} pendiente${cycle.pending === 1 ? '' : 's'}`;
};

/**
 * Ciclos del paciente (el más reciente arriba). Cada ciclo se corta en su sesión de
 * ingreso: si el paciente abandonó, se ve en cuántas sesiones quedó. Al desplegarlo
 * se ven todas sus fechas, también las pasadas.
 */
export default function AppointmentCycleHistory({ cycles = [], years = [] }) {
  const [openCycle, setOpenCycle] = useState(null);

  return (
    <div className="mt-6 border-t border-slate-100 pt-6">
      <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <History size={14} className="text-teal-500" /> Ciclos y fechas
      </h3>

      {years.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {years.map((item) => (
            <span key={item.year} className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-1 text-[10px] font-black text-teal-700">
              {item.year}: {item.totalCompleted} asistidas
            </span>
          ))}
        </div>
      )}

      {cycles.length === 0 ? (
        <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/40 p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sin ciclos registrados</p>
        </div>
      ) : (
        <div className="custom-scrollbar max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {cycles.map((cycle) => {
            const style = CYCLE_STYLES[cycle.state] || CYCLE_STYLES.INTERRUPTED;
            const isOpen = openCycle === cycle.cycleNumber;
            return (
              <div key={cycle.cycleNumber} className={`rounded-2xl border ${style.box}`}>
                <button
                  type="button"
                  onClick={() => setOpenCycle(isOpen ? null : cycle.cycleNumber)}
                  className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown size={14} className="shrink-0 text-slate-400" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase text-slate-700">
                      Ciclo {cycle.cycleNumber}
                      <span className="ml-2 font-semibold normal-case text-slate-500">{toDay(cycle.from)} → {toDay(cycle.to)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-600">{describeCycle(cycle)}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black uppercase ${style.badge}`}>{style.label}</span>
                </button>
                {isOpen && (
                  <ul className="space-y-1 border-t border-white/70 px-3 py-2">
                    {cycle.sessions.map((session) => {
                      const status = STATUS_LABELS[session.status] || STATUS_LABELS.SCHEDULED;
                      return (
                        <li key={session.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-slate-700">
                            Sesión {session.sessionNumber} · {format(new Date(session.date), "EEE dd/MM/yy", { locale: es })} {session.time}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${status.classes}`}>{status.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
