import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { buildClinicalHistoryPath, persistClinicalHistoryContext } from '../utils/appRoutes';
import { getCoverageLabel, isParticularCoverage } from '../utils/coverage';

const formatClinicalRecordNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) return 'Pendiente';
  return `HC ${String(numericValue).padStart(4, '0')}`;
};

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatAgendaDateLabel = (dateString) => {
  if (!dateString) return 'fecha sin definir';
  const parsedDate = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsedDate);
};

const buildAppointmentTimesLabel = (dayAppointments = []) => (
  dayAppointments
    .map((appointment) => appointment.time)
    .filter(Boolean)
    .join(' · ')
);

export default function ClinicalHistoriesPage() {
  const navigate = useNavigate();
  const todayValue = getLocalDateInputValue();
  const [scheduledPatients, setScheduledPatients] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const trimmedSearch = searchTerm.trim();
  const isSearching = trimmedSearch.length > 0;
  const visiblePatients = isSearching ? searchResults : scheduledPatients;
  const dateLabel = formatAgendaDateLabel(selectedDate);

  const fetchPatients = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      const response = await api.get('/patients/clinical-histories', {
        params: {
          date: selectedDate,
          ...(trimmedSearch ? { search: trimmedSearch } : {}),
        },
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setScheduledPatients(Array.isArray(response.data?.scheduledPatients) ? response.data.scheduledPatients : []);
      setSearchResults(Array.isArray(response.data?.searchResults) ? response.data.searchResults : []);
      if (response.data?.selectedDate) {
        setSelectedDate(response.data.selectedDate);
      }
      setError(null);
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError('No se pudieron cargar las historias clínicas');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedDate, trimmedSearch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPatients();
    }, trimmedSearch ? 250 : 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchPatients, trimmedSearch]);

  const handleRenumber = async () => {
    if (!window.confirm('¿Estás seguro de que deseas renumerar todos los pacientes secuencialmente? Se asignarán números desde el 0001 según la fecha de creación.')) return;
    try {
      setLoading(true);
      await api.post('/patients/admin/renumber');
      toast.success('Pacientes renumerados correctamente');
      await fetchPatients();
    } catch {
      toast.error('Error al renumerar');
      setLoading(false);
    }
  };

  const handleViewHistory = (patient) => {
    persistClinicalHistoryContext({ patientId: patient.id, patientName: patient.fullName });
    navigate(buildClinicalHistoryPath(patient.fullName), {
      state: {
        patientId: patient.id,
        patientName: patient.fullName,
      },
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-4 sm:p-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <FileText size={32} className="text-teal-600" />
            <h1 className="text-4xl font-bold text-slate-900">Historias Clínicas</h1>
          </div>
          <p className="max-w-4xl text-slate-600">
            La vista principal muestra solo los pacientes con atención en la fecha elegida.
            Si necesitas editar una historia fuera de ese día, puedes buscarla en toda la base clínica.
          </p>
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_auto]">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
              <CalendarDays size={14} />
              Fecha de atención
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayValue)}
              disabled={selectedDate === todayValue}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ir a hoy
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, DNI o número de HC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 py-3 pl-12 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <p className="mt-2 text-xs text-slate-500">
              {isSearching
                ? 'Búsqueda global activa: se revisa toda la base clínica.'
                : `Vista diaria activa: ${dateLabel}.`}
            </p>
          </div>

          <button
            onClick={handleRenumber}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-200"
            title="Renumerar todas las HC desde 0001"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            Renumerar Todo
          </button>
        </div>

        <div className="mb-5 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
            {isSearching ? 'Resultados globales' : 'Pacientes del día'}
          </p>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                {isSearching ? `Búsqueda: "${trimmedSearch}"` : dateLabel}
              </h2>
              <p className="text-sm text-slate-500">
                {isSearching
                  ? 'Usa esta búsqueda para abrir historias clínicas fuera del día seleccionado.'
                  : 'Ordenados según el horario de atención para que la carga diaria no se vuelva caótica.'}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pacientes visibles</p>
              <p className="text-2xl font-black text-slate-800">{visiblePatients.length}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin text-teal-500" size={40} />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 italic text-red-800">
            {error}
          </div>
        ) : visiblePatients.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-black text-slate-700">
              {isSearching ? 'No se encontraron historias clínicas.' : 'No hay pacientes para esta fecha.'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {isSearching
                ? 'Prueba con otro nombre, DNI o número de HC.'
                : 'Cuando haya turnos activos en ese día, aparecerán aquí ordenados por horario.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visiblePatients.map((patient) => {
              const appointmentTimesLabel = buildAppointmentTimesLabel(patient.dayAppointments);
              const hasAppointmentsOnSelectedDate = Array.isArray(patient.dayAppointments) && patient.dayAppointments.length > 0;

              return (
                <div
                  key={patient.id}
                  onClick={() => handleViewHistory(patient)}
                  className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-teal-400 hover:bg-teal-50 hover:shadow-md sm:p-6"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                        {formatClinicalRecordNumber(patient.clinicalRecordNumber)}
                      </p>
                      <h3 className="text-lg font-bold uppercase text-slate-900 group-hover:text-teal-700">
                        {patient.fullName}
                      </h3>
                      <p className="mt-1 font-mono text-sm text-slate-500">DNI: {patient.dni}</p>
                    </div>
                    <ChevronRight className="text-slate-300 transition-colors group-hover:text-teal-600" size={24} />
                  </div>

                  <div className="space-y-1 text-xs font-bold uppercase text-slate-500">
                    <p>Tel: {patient.phone || '---'}</p>
                    <p className={isParticularCoverage(patient.healthInsurance, patient.treatAsParticular) ? 'text-blue-700' : ''}>
                      OS: {getCoverageLabel(patient.healthInsurance, patient.treatAsParticular)}
                    </p>
                  </div>

                  <div className={`mt-4 rounded-2xl border px-4 py-3 ${hasAppointmentsOnSelectedDate ? 'border-teal-100 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
                    {hasAppointmentsOnSelectedDate ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-black text-teal-700">
                          <Clock3 size={15} />
                          <span>{appointmentTimesLabel}</span>
                        </div>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">
                          {patient.appointmentCount === 1 ? '1 turno en esta fecha' : `${patient.appointmentCount} turnos en esta fecha`}
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                        Resultado global fuera del día seleccionado
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

