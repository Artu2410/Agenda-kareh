import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, History, KeyRound, Loader2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
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

/** Token de obra social de una sesión: se ve y se carga/edita en el lugar. */
function SessionTokenField({ session, onSaveToken }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const token = session.sessionToken || '';

  const startEditing = () => {
    setDraft(token);
    setEditing(true);
  };

  const save = async () => {
    if (draft.trim() === token) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveToken(session.id, draft);
      toast.success(`Token de la sesión ${session.sessionNumber} guardado`);
      setEditing(false);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'No se pudo guardar el token');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="text"
          value={draft}
          maxLength={120}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); save(); }
            if (event.key === 'Escape') { event.preventDefault(); setEditing(false); }
          }}
          aria-label={`Token de la sesión ${session.sessionNumber}`}
          placeholder="Token"
          className="h-7 w-28 rounded-md border border-orange-200 bg-white px-2 text-[11px] font-bold text-slate-700 outline-none focus:border-orange-400"
        />
        <button type="button" onClick={save} disabled={saving} aria-label="Guardar token" className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600 text-white disabled:opacity-60">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} aria-label="Cancelar" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
          <X size={12} />
        </button>
      </div>
    );
  }

  if (!onSaveToken) {
    return token ? <span className="text-[10px] font-bold text-orange-700">{token}</span> : null;
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title={token ? 'Editar token' : 'Cargar token'}
      className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-black ${token
        ? 'border-orange-200 bg-orange-50 text-orange-700'
        : 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-orange-300 hover:text-orange-600'}`}
    >
      {token ? <KeyRound size={11} /> : <Pencil size={11} />}
      <span className="max-w-[7rem] truncate">{token || 'Token'}</span>
    </button>
  );
}

/**
 * Ciclos del paciente (el más reciente arriba). Cada ciclo se corta en su sesión de
 * ingreso: si el paciente abandonó, se ve en cuántas sesiones quedó. Al desplegarlo
 * se ven todas sus fechas, también las pasadas.
 */
export default function AppointmentCycleHistory({ cycles = [], years = [], onSaveToken = null }) {
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
        <div className="custom-scrollbar max-h-[420px] space-y-2 overflow-y-auto pr-1">
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
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                      {describeCycle(cycle)}
                      <span className="ml-1 text-orange-600">
                        · {cycle.sessions.filter((item) => item.sessionToken).length}/{cycle.sessions.length} tokens
                      </span>
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black uppercase ${style.badge}`}>{style.label}</span>
                </button>
                {isOpen && (
                  <ul className="space-y-1 border-t border-white/70 px-3 py-2">
                    {cycle.sessions.map((session) => {
                      const status = STATUS_LABELS[session.status] || STATUS_LABELS.SCHEDULED;
                      return (
                        <li key={session.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="min-w-0 font-bold text-slate-700">
                            Sesión {session.sessionNumber} · {format(new Date(session.date), "EEE dd/MM/yy", { locale: es })} {session.time}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <SessionTokenField session={session} onSaveToken={onSaveToken} />
                            <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${status.classes}`}>{status.label}</span>
                          </span>
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
