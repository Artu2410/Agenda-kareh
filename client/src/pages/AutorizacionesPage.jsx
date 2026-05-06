import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, RefreshCw, Search, XCircle } from 'lucide-react';
import api from '../services/api';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es-AR');
};

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'AUTHORIZED', label: 'Autorizados' },
  { value: 'REJECTED', label: 'Rechazados' },
  { value: 'ALL', label: 'Todos' },
];

const AuthorizationsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [filters, setFilters] = useState({
    status: 'PENDING',
    search: '',
  });

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/authorizations/list', {
        params: filters,
      });
      setAppointments(response.data || []);
    } catch (error) {
      console.error('Error cargando autorizaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAppointments();
  }, []);

  const stats = useMemo(() => ({
    pending: appointments.filter((appointment) => appointment.authorizationStatus === 'PENDING').length,
    authorized: appointments.filter((appointment) => appointment.authorizationStatus === 'AUTHORIZED').length,
    rejected: appointments.filter((appointment) => appointment.authorizationStatus === 'REJECTED').length,
  }), [appointments]);

  const reviewAppointment = async (appointmentId, decision) => {
    try {
      setSavingId(appointmentId);
      await api.patch(`/appointments/${appointmentId}/authorization`, { decision });
      await fetchAppointments();
    } catch (error) {
      console.error('Error revisando autorización:', error);
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">Gestión</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Autorizaciones</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Turnos con obra social que requieren validación administrativa.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAppointments}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700"
          >
            <RefreshCw size={16} /> Recargar
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Pendientes</p>
            <p className="mt-2 text-3xl font-black text-amber-600">{stats.pending}</p>
          </div>
          <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Autorizados</p>
            <p className="mt-2 text-3xl font-black text-emerald-600">{stats.authorized}</p>
          </div>
          <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Rechazados</p>
            <p className="mt-2 text-3xl font-black text-rose-600">{stats.rejected}</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Buscar por paciente, DNI u obra social"
                className="min-h-11 w-full rounded-2xl border border-slate-200 px-11 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchAppointments}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2 font-bold text-white"
            >
              Aplicar
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-400">Cargando autorizaciones...</div>
          ) : appointments.length === 0 ? (
            <div className="p-10 text-center text-sm font-bold text-slate-500">No hay turnos para esos filtros.</div>
          ) : (
            <div className="space-y-4 p-4 sm:p-6">
              {appointments.map((appointment) => (
                <article key={appointment.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black text-slate-800">{appointment.patient?.fullName}</p>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-500">
                          {appointment.authorizationStatus}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {formatDate(appointment.date)} · {appointment.time} · {appointment.professional?.fullName}
                      </p>
                      <p className="text-sm font-bold uppercase text-teal-700">
                        {appointment.obraSocial?.nombreOs || appointment.patient?.healthInsurance || 'Sin obra social'}
                      </p>
                      <p className="text-sm text-slate-500">
                        Coseguro paciente: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(appointment.patientChargeAmount || 0))}
                      </p>
                      {appointment.authorizationNumber && (
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          N° autorización: {appointment.authorizationNumber}
                        </p>
                      )}
                      {appointment.authorizationFileUrl && (
                        <a
                          href={appointment.authorizationFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase text-slate-600"
                        >
                          <FileText size={14} /> Ver archivo
                        </a>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => reviewAppointment(appointment.id, 'AUTHORIZED')}
                        disabled={savingId === appointment.id}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} /> Autorizar
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewAppointment(appointment.id, 'REJECTED')}
                        disabled={savingId === appointment.id}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                      >
                        <XCircle size={16} /> Rechazar
                      </button>
                    </div>
                  </div>
                  {Array.isArray(appointment.documentsChecklist?.documents) && appointment.documentsChecklist.documents.length > 0 && (
                    <div className="mt-4 rounded-[1.5rem] bg-white p-4">
                      <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        <Clock3 size={12} /> Documentación requerida
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {appointment.documentsChecklist.documents.map((document) => (
                          <div key={`${appointment.id}-${document.name}`} className="rounded-2xl border border-slate-200 p-3">
                            <p className="text-sm font-bold text-slate-800">{document.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {document.presented ? 'Presentado' : 'Pendiente'}
                              {document.validityDays ? ` · Vigencia ${document.validityDays} días` : ' · Sin vencimiento'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AuthorizationsPage;
