import React from 'react';
import { Calendar as CalendarIcon, Printer, Loader2, Trash2, History, Pencil, Check, X, Flag, Plus, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PrintSessions from './PrintSessions';
import { useAppointmentForm } from '../hooks/useAppointmentForm';
import { getCoverageLabel, isParticularCoverage } from '../utils/coverage';

const WEEK_DAYS = [
  { label: 'L', value: 1 }, { label: 'Ma', value: 2 }, { label: 'Mi', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 },
];

const APPOINTMENT_STATUSES = [
  { value: 'SCHEDULED', label: 'Programado', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'PENDING_AUTHORIZATION', label: 'Pend. autorización', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'AUTHORIZED', label: 'Autorizado', classes: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'REJECTED', label: 'Rechazado', classes: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'COMPLETED', label: 'Asistió', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'NO_SHOW', label: 'Inasistencia', classes: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const PARTICULAR_OPTION_VALUE = '__PARTICULAR__';

const buildChecklistFromInsurance = (obraSocial, currentChecklist = null) => {
  if (currentChecklist?.documents?.length) {
    return currentChecklist;
  }

  const documents = Array.isArray(obraSocial?.requiredDocuments?.documents)
    ? obraSocial.requiredDocuments.documents.map((document) => ({
      ...document,
      presented: false,
      fileUrl: null,
      fileName: null,
      presentedAt: null,
    }))
    : [];

  return {
    documents,
    additionalInfo: obraSocial?.requiredDocuments?.additionalInfo || '',
  };
};

const formatCurrency = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
}).format(Number(value || 0));

const SectionHeader = ({ title, description }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
    {description && (
      <p className="text-sm font-medium text-slate-500">{description}</p>
    )}
  </div>
);

const AppointmentModal = ({ isOpen, onClose, onSave, onDelete, onRefresh, selectedSlot, appointment = null, professional = null }) => {
  const {
    ConfirmModalComponent,
    isEditMode,
    modalDate,
    modalTime,
    hasSessionBoundaryChange,
    isPendingCycleReset,
    patientData,
    setPatientData,
    diagnosis,
    setDiagnosis,
    status,
    setStatus,
    isFirstSession,
    setIsFirstSession,
    sessionCount,
    setSessionCount,
    selectedDays,
    setSelectedDays,
    loading,
    showPrintModal,
    createdAppointments,
    futureAppointments,
    sessionCycles,
    editingFutureId,
    futureDraft,
    savingFutureId,
    ticketLoading,
    isAddingManualSession,
    manualDraft,
    obrasSociales,
    setDocumentsChecklist,
    authorizationNumber,
    setAuthorizationNumber,
    authorizationFileUrl,
    paidInAdvance,
    setPaidInAdvance,
    sessionToken,
    setSessionToken,
    uploadingAuthorization,
    selectedObraSocial,
    patientChargeBreakdown,
    selectedCoverageValue,
    projectedSessions,
    projectedEditSessions,
    handleAction,
    handleDelete,
    startEditingFutureAppointment,
    cancelEditingFutureAppointment,
    handleFutureAppointmentChange,
    handleFutureAppointmentSave,
    handleCreateIndividualSession,
    handleGenerateAdditionalSessions,
    handleOpenTicket,
    handlePrintModalClose,
    handleAuthorizationFileUpload,
    searchPatient,
    setIsAddingManualSession,
    setManualDraft,
  } = useAppointmentForm({
    isOpen,
    onClose,
    onSave,
    onDelete,
    onRefresh,
    selectedSlot,
    appointment,
    professional,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-stretch justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-none border border-white/20 bg-white shadow-2xl sm:h-[90vh] sm:rounded-4xl md:flex-row">

        {/* COLUMNA IZQUIERDA: FORMULARIO + HISTORIA */}
        <div className="flex flex-1 flex-col overflow-hidden border-b border-slate-100 bg-white md:border-b-0 md:border-r">
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-slate-800 sm:text-2xl">
                  {isEditMode
                    ? `Sesión ${isFirstSession ? '1' : (appointment.sessionNumber || '')}${isFirstSession ? ' (Ingreso)' : ''}`
                    : 'Nuevo Turno'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    {modalDate ? format(new Date(`${modalDate}T12:00:00`), "eeee dd 'de' MMMM", { locale: es }) : ''}
                  </p>
                  {isEditMode && !isFirstSession && (
                    <button
                      type="button"
                      onClick={() => setIsFirstSession(true)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase transition-all hover:bg-rose-100"
                    >
                      <Flag size={9} fill="currentColor" /> Reiniciar Ciclo (Sesión 1)
                    </button>
                  )}
                  {isEditMode && isFirstSession && !isPendingCycleReset && (
                    <span className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] font-black uppercase text-teal-600 anima-pulse">
                      <Check size={10} /> Inicio de Ciclo
                    </span>
                  )}
                  {isEditMode && isPendingCycleReset && (
                    <button
                      type="button"
                      onClick={() => setIsFirstSession(false)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase text-amber-700 transition-all hover:bg-amber-100"
                    >
                      <X size={10} /> Deshacer reinicio
                    </button>
                  )}
                  {paidInAdvance && (
                    <span className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase text-emerald-700">
                      <Banknote size={10} /> Pago adelantado
                    </span>
                  )}
                </div>
                <p className="text-teal-600 text-[10px] font-black uppercase tracking-widest mt-2">
                  {isEditMode ? appointment?.professional?.fullName : professional?.fullName || 'Profesional no seleccionado'}
                </p>
              </div>
              <div className="self-start rounded-2xl border border-teal-100 bg-teal-50 px-5 py-3 text-center">
                <p className="text-teal-600 font-black text-xl leading-none">{modalTime}</p>
                <p className="text-[9px] text-teal-500 font-bold uppercase tracking-widest">Horario</p>
              </div>
            </div>

            <div className="space-y-6">
              <section className="space-y-4">
                <SectionHeader
                  title="Paciente"
                  description="Datos personales y cobertura principal del turno."
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DNI del Paciente</label>
                    <input aria-label="DNI del Paciente" className="w-full min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold outline-none focus:ring-2 ring-teal-500" value={patientData.dni} onChange={e => { setPatientData({ ...patientData, dni: e.target.value }); searchPatient('dni', e.target.value); }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Obra Social</label>
                    <select
                      aria-label="Obra Social"
                      className="w-full min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold outline-none focus:ring-2 ring-teal-500"
                      value={selectedCoverageValue}
                      onChange={(e) => {
                        const obraSocialId = e.target.value;
                        if (obraSocialId === PARTICULAR_OPTION_VALUE) {
                          setPatientData((prev) => {
                            const hasCoverageLoaded = Boolean(prev.obraSocialId || prev.healthInsurance);
                            return {
                              ...prev,
                              obraSocialId: prev.obraSocialId || '',
                              healthInsurance: hasCoverageLoaded ? prev.healthInsurance : 'PARTICULAR',
                              treatAsParticular: true,
                            };
                          });
                          setDocumentsChecklist({ documents: [], additionalInfo: '' });
                          return;
                        }

                        const obraSocial = obrasSociales.find((item) => item.id === obraSocialId) || null;
                        setPatientData((prev) => ({
                          ...prev,
                          obraSocialId,
                          healthInsurance: obraSocial?.nombreOs || '',
                          treatAsParticular: false,
                        }));
                        setDocumentsChecklist(buildChecklistFromInsurance(obraSocial, null));
                      }}
                    >
                      <option value="">Seleccionar obra social</option>
                      <option value={PARTICULAR_OPTION_VALUE}>PARTICULAR</option>
                      {obrasSociales
                        .filter((obraSocial) => obraSocial.isActive || obraSocial.id === patientData.obraSocialId)
                        .map((obraSocial) => (
                          <option key={obraSocial.id} value={obraSocial.id}>
                            {obraSocial.nombreOs}{obraSocial.isActive ? '' : ' · INACTIVA'}
                          </option>
                      ))}
                    </select>
                  </div>
                </div>
                <input aria-label="Apellido" placeholder="Apellido" className="min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold" value={patientData.lastName} onChange={e => setPatientData({ ...patientData, lastName: e.target.value })} />
                <input aria-label="Nombre" placeholder="Nombre" className="min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold" value={patientData.firstName} onChange={e => setPatientData({ ...patientData, firstName: e.target.value })} />
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">N° Afiliado</label>
                  <input aria-label="Número de Afiliado" className="w-full min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold outline-none focus:ring-2 ring-teal-500" value={patientData.affiliateNumber || ''} onChange={e => setPatientData({ ...patientData, affiliateNumber: e.target.value })} />
                </div>
                <div className="sm:col-span-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tratamiento Particular</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {patientData.treatAsParticular
                          ? `Se tomará como ${getCoverageLabel(patientData.healthInsurance, true)}`
                          : 'Usa la cobertura cargada'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPatientData((prev) => {
                        const nextValue = !prev.treatAsParticular;
                        if (nextValue) {
                          const hasCoverageLoaded = Boolean(prev.obraSocialId || prev.healthInsurance);
                          return {
                            ...prev,
                            obraSocialId: prev.obraSocialId || '',
                            healthInsurance: hasCoverageLoaded ? prev.healthInsurance : 'PARTICULAR',
                            treatAsParticular: true,
                          };
                        }

                        return {
                          ...prev,
                          healthInsurance: prev.healthInsurance === 'PARTICULAR' ? '' : prev.healthInsurance,
                          treatAsParticular: false,
                        };
                      })}
                      className={`inline-flex min-h-11 items-center rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${patientData.treatAsParticular
                          ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                          : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-700'
                        }`}
                    >
                      {patientData.treatAsParticular ? 'Activo' : 'Desactivado'}
                    </button>
                  </div>
                  {!!patientData.healthInsurance?.trim() && !isParticularCoverage(patientData.healthInsurance) && (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Cobertura original: {getCoverageLabel(patientData.healthInsurance)}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Sesión pagada por adelantado</p>
                      <p className="mt-1 text-[11px] font-semibold text-emerald-700/80">
                        {isEditMode
                          ? 'Marcá este turno si ya quedó cobrado.'
                          : 'Si generás varias sesiones, se marca solo el primer turno.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaidInAdvance((current) => !current)}
                      className={`inline-flex min-h-11 items-center rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                        paidInAdvance
                          ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
                          : 'bg-white text-emerald-700 border border-emerald-200 hover:border-emerald-300'
                      }`}
                    >
                      {paidInAdvance ? 'Marcada' : 'Sin marcar'}
                    </button>
                  </div>
                </div>

                {selectedObraSocial && selectedObraSocial.isActive === false && (
                  <div className="sm:col-span-2 rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-[11px] font-black uppercase tracking-wide text-amber-800">
                          Esta obra social se encuentra inactiva o sin convenio vigente.
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-amber-700/80 uppercase">
                          No se podrán procesar pagos por COKIBA. Podés atenderlo de forma Particular.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPatientData((prev) => ({
                            ...prev,
                            treatAsParticular: true,
                          }));
                          setDocumentsChecklist({ documents: [], additionalInfo: '' });
                        }}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-amber-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-amber-700"
                      >
                        Atender Particular
                      </button>
                    </div>
                  </div>
                )}

                {!!selectedObraSocial && !patientData.treatAsParticular && (
                  <div className="sm:col-span-2 rounded-[1.6rem] border border-teal-100 bg-teal-50/70 px-4 py-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-teal-600">Coseguro calculado</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[9px] font-black uppercase text-slate-400">Base</p>
                        <p className="mt-1 text-sm font-black text-slate-800">{formatCurrency(patientChargeBreakdown.baseCopay)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[9px] font-black uppercase text-slate-400">% adicional</p>
                        <p className="mt-1 text-sm font-black text-slate-800">{formatCurrency(patientChargeBreakdown.percentageAmount)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[9px] font-black uppercase text-slate-400">Copago fijo</p>
                        <p className="mt-1 text-sm font-black text-slate-800">{formatCurrency(patientChargeBreakdown.fixedCopay)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-900 px-3 py-3 text-white">
                        <p className="text-[9px] font-black uppercase text-slate-300">Total paciente</p>
                        <p className="mt-1 text-sm font-black">{formatCurrency(patientChargeBreakdown.total)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!!selectedObraSocial?.requiresAuthorization && !patientData.treatAsParticular && (
                  <div className="sm:col-span-2 rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-700">Autorización requerida</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        type="text"
                        aria-label="Número de autorización"
                        placeholder="Número de autorización"
                        value={authorizationNumber}
                        onChange={(event) => setAuthorizationNumber(event.target.value)}
                        className="min-h-11 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-200"
                      />
                      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 py-2 text-xs font-black uppercase text-amber-700">
                        {uploadingAuthorization ? 'Subiendo...' : 'Subir PDF / imagen'}
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleAuthorizationFileUpload} />
                      </label>
                    </div>
                    {authorizationFileUrl && (
                      <a href={authorizationFileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-amber-700 underline">
                        Ver autorización adjunta
                      </a>
                    )}
                  </div>
                )}

                <div className="sm:col-span-2 rounded-[1.6rem] border border-orange-200 bg-orange-50 px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-orange-700 uppercase tracking-widest ml-1">Token de Sesión (Obra Social)</label>
                      <input
                        type="text"
                        aria-label="Token de Sesión (Obra Social)"
                        placeholder="Ingrese el número de token / validación"
                        className="w-full min-h-11 rounded-2xl border border-orange-200 bg-white p-3 font-bold text-orange-800 outline-none focus:ring-2 ring-orange-500"
                        value={sessionToken}
                        onChange={(e) => setSessionToken(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader
                  title="Sesiones"
                  description="Contacto, evolución y controles del turno."
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                    <input type="tel" aria-label="Teléfono" placeholder="+54 9 11 2345-6789" className="w-full min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold outline-none focus:ring-2 ring-teal-500" value={patientData.phone || ''} onChange={e => setPatientData({ ...patientData, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Nacimiento</label>
                    <input type="date" aria-label="Fecha de Nacimiento" className="w-full min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold outline-none focus:ring-2 ring-teal-500" value={patientData.birthDate || ''} onChange={e => setPatientData({ ...patientData, birthDate: e.target.value })} />
                  </div>
                </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnóstico / Evolución</label>
                <textarea aria-label="Diagnóstico / Evolución" className="w-full min-h-28 resize-none rounded-2xl border bg-slate-50 p-4 font-semibold uppercase outline-none focus:ring-2 ring-teal-500" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
              </div>

              {isEditMode && (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado del Turno</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {APPOINTMENT_STATUSES.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setStatus(item.value)}
                          className={`min-h-11 rounded-2xl border px-3 py-3 text-[10px] font-black uppercase transition-all ${status === item.value
                              ? item.classes
                              : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-teal-50/50 rounded-2xl border border-teal-100">
                    <input
                      type="checkbox"
                      id="isFirstSession"
                      checked={isFirstSession}
                      onChange={e => setIsFirstSession(e.target.checked)}
                      className="w-4 h-4 accent-teal-600"
                    />
                    <label htmlFor="isFirstSession" className="text-[10px] font-black uppercase text-teal-700 cursor-pointer">
                      Marcar como Sesión de Ingreso (Reinicia contador)
                    </label>
                  </div>
                  {hasSessionBoundaryChange && (
                    <div className={`flex items-start gap-2 rounded-2xl border px-3 py-3 text-[10px] font-black ${
                      isPendingCycleReset
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}>
                      <Flag size={14} className="mt-0.5 shrink-0" />
                      <p>
                        {isPendingCycleReset
                          ? 'Al guardar, este turno pasará a ser la nueva sesión 1 y se renumerarán las sesiones siguientes.'
                          : 'Al guardar, este turno dejará de ser inicio de ciclo y se renumerarán las sesiones siguientes.'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {(!isEditMode || futureAppointments.length <= 1) && (
                <div className="grid grid-cols-1 items-center gap-6 rounded-3xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Días Semanales</label>
                    <div className="grid w-full grid-cols-7 gap-2">
                      {WEEK_DAYS.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => setSelectedDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])}
                          className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-2 py-3 text-[10px] font-black leading-none transition-all ${selectedDays.includes(day.value) ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 flex flex-col justify-center">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{isEditMode ? 'Generar más sesiones' : 'Cantidad Sesiones'}</label>
                    <div className="flex gap-2 items-center">
                      <input type="number" className="min-h-11 w-20 rounded-xl border bg-white px-2 py-2 text-center font-black text-teal-700 shadow-sm" value={sessionCount} onChange={e => setSessionCount(e.target.value)} />
                      {isEditMode && (
                        <button
                          type="button"
                          onClick={handleGenerateAdditionalSessions}
                          disabled={loading}
                          className="min-h-11 rounded-xl bg-teal-100 px-4 py-2 text-[10px] font-black uppercase text-teal-700 transition-all hover:bg-teal-200"
                        >
                          Generar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 rounded-4xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { key: 'hasCancer', label: 'Oncológico', color: 'accent-red-500' },
                  { key: 'hasMarcapasos', label: 'Marcapasos', color: 'accent-blue-500' },
                  { key: 'usesEA', label: 'E.A.', color: 'accent-amber-500' },
                  { key: 'usesWheelchair', label: 'Silla Ruedas 🦽', color: 'accent-slate-600' },
                  { key: 'isRespiratory', label: 'Respiratorio 🫁', color: 'accent-rose-500' },
                  { key: 'isIU', label: 'I.U. Piso Pélvico 💧', color: 'accent-orange-500' }
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className={`${item.color} w-4 h-4`} checked={patientData[item.key]} onChange={e => setPatientData({ ...patientData, [item.key]: e.target.checked })} />
                    <span className={`text-[10px] font-black uppercase ${patientData[item.key] ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* CICLOS DE SESIONES POR AÑO */}
              {isEditMode && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <History size={14} className="text-teal-500" /> Ciclos por Año
                  </h3>
                  <div className="max-h-[260px] overflow-y-auto pr-1 custom-scrollbar space-y-4">
                    {sessionCycles.length > 0 ? sessionCycles.map((yearData) => (
                      <div key={yearData.year} className="rounded-[1.6rem] border border-slate-100 bg-slate-50/60 p-4">
                        {/* Encabezado año */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide">{yearData.year}</span>
                          <span className="text-[10px] font-black text-teal-600 bg-teal-50 border border-teal-100 px-3 py-1 rounded-xl">
                            {yearData.totalCompleted} sesiones asistidas
                          </span>
                        </div>
                        {/* Ciclos completados */}
                        {yearData.cycles.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {yearData.cycles.map((cycle) => (
                              <div key={cycle.cycleNumber} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                                  {cycle.cycleNumber}
                                </div>
                                <div>
                                  <p className="text-[9px] font-black text-emerald-700 uppercase leading-none">Ciclo {cycle.cycleNumber}</p>
                                  <p className="text-[8px] text-emerald-500 font-semibold leading-none mt-0.5">
                                    {format(new Date(cycle.from), 'dd/MM', { locale: es })} → {format(new Date(cycle.to), 'dd/MM', { locale: es })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Ciclo en curso */}
                        {yearData.sessionsInCurrentCycle > 0 && (
                          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-1">
                            <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-dashed flex items-center justify-center text-[9px] font-black text-amber-600 shrink-0">
                              {yearData.completedCycles + 1}
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-amber-700 uppercase leading-none">Ciclo {yearData.completedCycles + 1} en curso</p>
                              <p className="text-[8px] text-amber-500 font-semibold leading-none mt-0.5">
                                {yearData.sessionsInCurrentCycle} / 10 sesiones
                              </p>
                            </div>
                            <div className="ml-auto flex gap-0.5">
                              {Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full ${i < yearData.sessionsInCurrentCycle ? 'bg-amber-400' : 'bg-amber-100'}`} />
                              ))}
                            </div>
                          </div>
                        )}
                        {yearData.totalCompleted === 0 && (
                          <p className="text-[10px] text-slate-400 font-bold italic">Sin sesiones completadas</p>
                        )}
                      </div>
                    )) : (
                      <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/40 p-5 text-center">
                        <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Sin ciclos registrados</p>
                        <p className="text-[9px] text-slate-300 font-semibold mt-1">Los ciclos se contabilizan cuando el turno pasa a "Asistió"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </section>

              <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-slate-100 bg-white/95 px-4 pb-4 pt-4 backdrop-blur sm:-mx-8 sm:px-8">
                <div className="mb-3">
                  <SectionHeader
                    title="Acciones"
                    description="Guardar, cancelar o eliminar sesiones."
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button onClick={onClose} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-3xl border border-slate-200 py-4 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:border-slate-300 hover:text-slate-600">Cancelar</button>
                  <button onClick={handleAction} disabled={loading} className="inline-flex min-h-11 flex-[2] items-center justify-center gap-2 rounded-3xl bg-teal-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-teal-700">
                    {loading ? <Loader2 className="animate-spin" size={18} /> : (isEditMode ? 'Guardar Cambios' : 'Confirmar y Agendar')}
                  </button>
                </div>

                {isEditMode && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button onClick={() => handleDelete('single')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[10px] font-black uppercase text-red-600 transition hover:bg-red-100"><Trash2 size={14} /> Solo hoy</button>
                    <button onClick={() => handleDelete('future')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase text-white shadow-md transition hover:bg-red-700"><Trash2 size={14} /> Sesiones futuras</button>
                  </div>
                )}
              </div>
            </div>
        </div>
        </div>

        {/* COLUMNA DERECHA: SESIONES */}
        <div className="flex w-full flex-col border-t border-slate-100 bg-slate-50 p-4 sm:p-6 md:w-80 md:border-l md:border-t-0 lg:p-8">
          <h3 className="mb-6 flex items-center justify-between border-b border-slate-200 pb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-2">
              <CalendarIcon size={14} className="text-teal-500" />
              {isEditMode
                ? (futureAppointments.length <= 1 && projectedEditSessions.length > 0)
                  ? `${projectedEditSessions.length} A Programar`
                  : `${futureAppointments.length} Sesiones Futuras`
                : `${projectedSessions.length} Proyectadas`}
            </div>
            {isEditMode && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingManualSession(true);
                  setManualDraft({ date: modalDate, time: modalTime });
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-lg p-2 text-teal-600 transition-colors hover:bg-teal-50"
                title="Agregar sesión individual"
              >
                <Plus size={16} />
              </button>
            )}
          </h3>

          {isAddingManualSession && (
            <div className="mb-4 bg-teal-50/50 p-3 rounded-xl border border-teal-100 space-y-3 animate-in fade-in slide-in-from-top-2">
              <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Nueva sesión individual</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 ring-teal-500"
                  value={manualDraft.date}
                  onChange={(e) => setManualDraft(prev => ({ ...prev, date: e.target.value }))}
                />
                <input
                  type="time"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 ring-teal-500"
                  value={manualDraft.time}
                  onChange={(e) => setManualDraft(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingManualSession(false)}
                  className="inline-flex min-h-11 items-center px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateIndividualSession}
                  disabled={loading}
                  className="inline-flex min-h-11 items-center rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-black uppercase text-white shadow-sm hover:bg-teal-700"
                >
                  Agendar
                </button>
              </div>
            </div>
          )}
          {isEditMode && futureAppointments.length <= 1 && projectedEditSessions.length > 0 && (
            <p className="text-[9px] font-bold text-teal-500 uppercase tracking-widest mb-3 -mt-4">
              Vista previa · Seleccioná días y presioná Generar
            </p>
          )}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(isEditMode
              ? (futureAppointments.length <= 1 && projectedEditSessions.length > 0) ? projectedEditSessions : futureAppointments
              : projectedSessions
            ).map((apt, idx) => {
              const displaySessionNumber = apt.sessionNumber || idx + 1;

              return (
                <div
                  key={apt.id || idx}
                  className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-teal-300 ${editingFutureId === apt.id ? 'space-y-3' : 'flex justify-between items-center'
                    }`}
                >
                  {editingFutureId === apt.id ? (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="date"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 ring-teal-500"
                          value={futureDraft.date}
                          onChange={(e) => handleFutureAppointmentChange('date', e.target.value)}
                        />
                        <input
                          type="time"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 ring-teal-500"
                          value={futureDraft.time}
                          onChange={(e) => handleFutureAppointmentChange('time', e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditingFutureAppointment}
                          disabled={savingFutureId === apt.id}
                          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase text-slate-400 transition-all hover:border-slate-300"
                        >
                          <X size={12} />
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFutureAppointmentSave(apt)}
                          disabled={savingFutureId === apt.id}
                          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-teal-700"
                        >
                          {savingFutureId === apt.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Guardar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Sesión {apt.isFirstSession ? 1 : displaySessionNumber} {apt.isFirstSession && <span className="text-teal-600 ml-1 font-black">(Ingreso)</span>}
                        </p>
                        <span className="text-[11px] font-bold text-slate-700">{format(new Date(apt.date), "dd 'de' MMMM", { locale: es })}</span>
                        {apt.paidInAdvance && (
                          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                            Pago adelantado
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">{apt.time} hs</span>
                        {isEditMode && apt.id && (
                          <button
                            type="button"
                            onClick={() => startEditingFutureAppointment(apt)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all hover:border-teal-400 hover:text-teal-600"
                            aria-label="Editar sesión futura"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={handleOpenTicket}
            disabled={ticketLoading}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm transition-all hover:border-teal-500 hover:text-teal-600"
          >
            {ticketLoading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            Vista Ticket
          </button>
        </div>
      </div>

      {showPrintModal && (
        <PrintSessions
          isOpen={showPrintModal}
          onClose={handlePrintModalClose}
          appointments={createdAppointments}
          patientData={{
            ...patientData,
            fullName: `${patientData.lastName} ${patientData.firstName}`.trim(),
          }}
          diagnosis={diagnosis}
          appointmentId={appointment?.id || createdAppointments?.[0]?.id}
        />
      )}
      {ConfirmModalComponent}
    </div>
  );
};

export default AppointmentModal;
