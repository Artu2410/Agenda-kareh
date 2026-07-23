import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, ChevronRight, X } from 'lucide-react';
import { buildAppointmentDailyPresentation } from './appointmentVisuals.jsx';

const sortAppointments = (appointments = []) => (
  [...appointments].sort((left, right) => (
    `${left.time || ''}-${left.slotNumber || 0}`.localeCompare(`${right.time || ''}-${right.slotNumber || 0}`)
  ))
);

const buildCountLabel = (count) => `${count} turno${count === 1 ? '' : 's'}`;

const MonthDayAppointmentsModal = ({
  isOpen,
  day,
  appointments = [],
  onClose,
  onAppointmentClick,
}) => {
  if (!isOpen || !day) {
    return null;
  }

  const dayAppointments = sortAppointments(appointments);
  const dateLabel = format(day, "EEEE d 'de' MMMM", { locale: es });

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby="month-day-appointments-title"
        aria-modal="true"
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-teal-600">
              Vista mensual
            </p>
            <h2 id="month-day-appointments-title" className="mt-1 truncate text-lg font-black capitalize text-slate-800">
              {dateLabel}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {buildCountLabel(dayAppointments.length)} programado{dayAppointments.length === 1 ? '' : 's'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal-300 hover:text-teal-600"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-6">
          {dayAppointments.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <CalendarClock size={32} className="text-slate-300" />
              <p className="text-lg font-black text-slate-700">No hay turnos para este día</p>
              <p className="max-w-sm text-sm font-medium text-slate-400">
                La lista completa del día aparece cuando hay pacientes cargados en la agenda mensual.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayAppointments.map((appointment) => {
                const { statusMeta, badges, clinicalIcons } = buildAppointmentDailyPresentation(appointment);

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    aria-label={`Abrir turno de ${appointment.patient?.fullName || 'Paciente'} a las ${appointment.time || 'sin hora'}`}
                    onClick={() => onAppointmentClick(appointment)}
                    className={`w-full rounded-[1.75rem] border-l-4 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${statusMeta.cardClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-800">
                          {appointment.patient?.fullName}
                        </p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {appointment.time}
                        </p>
                      </div>

                      <span className="inline-flex min-h-11 items-center rounded-2xl bg-white/80 px-3 py-2 text-sm font-black text-slate-700 shadow-sm">
                        {appointment.time}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {badges.map((badge) => (
                        <span
                          key={`${appointment.id}-${badge.key}`}
                          className={`inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${badge.className}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      ))}
                    </div>

                    {appointment.diagnosis && (
                      <p className="mt-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600">
                        {appointment.diagnosis}
                      </p>
                    )}

                    {clinicalIcons.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {clinicalIcons.map((item) => (
                          <span
                            key={`${appointment.id}-${item.key}`}
                            className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/70 px-2 py-1 text-[11px] font-bold text-slate-600"
                            title={item.title}
                          >
                            {item.icon}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Tocar para abrir o editar
                      <ChevronRight size={14} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthDayAppointmentsModal;
