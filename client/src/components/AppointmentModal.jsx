import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, Printer, Loader2, Trash2, History, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '@/services/api';
import { getCoverageLabel, isParticularCoverage } from '@/utils/coverage';
import PrintSessions from './PrintSessions';
import { useConfirmModal } from '../hooks/useConfirmModal';

const WEEK_DAYS = [
  { label: 'L', value: 1 }, { label: 'Ma', value: 2 }, { label: 'Mi', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 },
];

const APPOINTMENT_STATUSES = [
  { value: 'SCHEDULED', label: 'Programado', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'COMPLETED', label: 'Asistió', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'NO_SHOW', label: 'Inasistencia', classes: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const getInputDateValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return format(new Date(value), 'yyyy-MM-dd');
};

const UNKNOWN_BIRTHDATE = '1900-01-01';

const isUnknownBirthDate = (birthDate) => {
  if (!birthDate) return true;
  const dateString = birthDate.includes('T') ? birthDate.split('T')[0] : birthDate;
  return dateString <= UNKNOWN_BIRTHDATE;
};

const AppointmentModal = ({ isOpen, onClose, onSave, onDelete, onRefresh, selectedSlot, appointment = null, professional = null }) => {
  const [patientData, setPatientData] = useState({
    dni: '', lastName: '', firstName: '', phone: '', birthDate: '',
    healthInsurance: '', treatAsParticular: false, affiliateNumber: '',
    hasCancer: false, hasMarcapasos: false, usesEA: false,
  });

  const [diagnosis, setDiagnosis] = useState('');
  const [status, setStatus] = useState('SCHEDULED');
  const [sessionCount, setSessionCount] = useState(10);
  const [selectedDays, setSelectedDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [createdAppointments, setCreatedAppointments] = useState([]);
  const [futureAppointments, setFutureAppointments] = useState([]);
  const [editingFutureId, setEditingFutureId] = useState(null);
  const [futureDraft, setFutureDraft] = useState({ date: '', time: '' });
  const [savingFutureId, setSavingFutureId] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [closeAfterPrintPreview, setCloseAfterPrintPreview] = useState(false);
  
  const lastSearchedRef = useRef('');
  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const isEditMode = !!appointment?.id;
  const modalDate = selectedSlot?.date || getInputDateValue(appointment?.date);
  const modalTime = selectedSlot?.time || appointment?.time || '';

  const loadFutureAppointments = useCallback(async () => {
    if (!appointment?.patientId) {
      setFutureAppointments([]);
      return;
    }

    try {
      const { data } = await api.get(`/patients/${appointment.patientId}/future-appointments`);
      setFutureAppointments(data || []);
    } catch (error) {
      console.error(error);
    }
  }, [appointment?.patientId]);

  const projectedSessions = useMemo(() => {
    if (isEditMode) return [];
    if (selectedDays.length === 0 || !selectedSlot?.date) return [];
    const sessions = [];
    const [year, month, day] = selectedSlot.date.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day, 12, 0, 0);
    const count = parseInt(sessionCount) || 0;
    while (sessions.length < count && sessions.length < 60) {
      if (selectedDays.includes(currentDate.getDay())) {
        sessions.push({ date: new Date(currentDate), time: selectedSlot.time });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return sessions;
  }, [selectedDays, sessionCount, selectedSlot, isEditMode]);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && appointment) {
      const p = appointment.patient;
      const nameParts = (p.fullName || '').split(' ');
      setPatientData({
        dni: p.dni || '',
        lastName: nameParts[0] || '',
        firstName: nameParts.slice(1).join(' ') || '',
        phone: p.phone || '',
        birthDate: p.birthDate && !isUnknownBirthDate(p.birthDate) ? p.birthDate.split('T')[0] : '',
        healthInsurance: p.healthInsurance || '',
        treatAsParticular: p.treatAsParticular || false,
        affiliateNumber: p.affiliateNumber || '',
        hasCancer: p.hasCancer || false,
        hasMarcapasos: p.hasMarcapasos || false,
        usesEA: p.usesEA || false,
      });
      setDiagnosis(appointment.diagnosis || '');
      setStatus(appointment.status || 'SCHEDULED');
      setEditingFutureId(null);
      setFutureDraft({ date: '', time: '' });
      loadFutureAppointments();
    } else {
      setPatientData({
        dni: '', lastName: '', firstName: '', phone: '',
        healthInsurance: '', treatAsParticular: false, affiliateNumber: '',
        hasCancer: false, hasMarcapasos: false, usesEA: false,
      });
      setDiagnosis('');
      setStatus('SCHEDULED');
      setSessionCount(10);
      setFutureAppointments([]);
      setEditingFutureId(null);
      setFutureDraft({ date: '', time: '' });
      if (selectedSlot) {
        const [y, m, d] = selectedSlot.date.split('-').map(Number);
        setSelectedDays([new Date(y, m - 1, d, 12, 0, 0).getDay()]);
      }
    }
  }, [isOpen, isEditMode, appointment, selectedSlot, loadFutureAppointments]);

  const searchPatient = useCallback(async (field, value) => {
    if (value.length < 5 || value === lastSearchedRef.current) return;
    lastSearchedRef.current = value;
    try {
      const { data } = await api.get(`/patients/search?${field}=${value}`);
      if (data) {
        const nameParts = (data.fullName || '').split(' ');
        setPatientData(prev => ({
          ...prev,
          lastName: nameParts[0] || '', firstName: nameParts.slice(1).join(' ') || '',
          dni: data.dni || prev.dni, phone: data.phone || '',
          birthDate: data.birthDate && !isUnknownBirthDate(data.birthDate) ? data.birthDate.split('T')[0] : prev.birthDate,
          healthInsurance: data.healthInsurance || '',
          treatAsParticular: data.treatAsParticular || false,
          affiliateNumber: data.affiliateNumber || '',
          hasCancer: data.hasCancer || false, hasMarcapasos: data.hasMarcapasos || false, usesEA: data.usesEA || false,
        }));
      }
    } catch {
      // Si no existe el paciente todavía, dejamos el formulario para alta manual.
    }
  }, []);

  const handleAction = async () => {
    setLoading(true);
    const fullName = `${patientData.lastName} ${patientData.firstName}`.trim();
    try {
      const payload = { 
        diagnosis, 
        status,
        patientData: { 
          ...patientData, 
          fullName,
          birthDate: patientData.birthDate ? new Date(patientData.birthDate).toISOString() : null
        } 
      };
      if (isEditMode) {
        await api.patch(`/appointments/${appointment.id}/evolution`, payload);
        await onSave?.();
      } else {
        if (!professional?.id) {
          alert('Selecciona un profesional para agendar.');
          return;
        }

        const fullPayload = {
          ...payload,
          professionalId: professional.id,
          date: selectedSlot.date,
          time: selectedSlot.time,
          sessionCount,
          selectedDays
        };
        const { data } = await api.post('/appointments', fullPayload);
        setCreatedAppointments(data.appointments || []);
        setCloseAfterPrintPreview(true);
        setShowPrintModal(true);
        onRefresh?.();
      }
    } catch { alert('Error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (mode = 'single') => {
    const confirmMessage = mode === 'future'
      ? '¿Confirmar eliminación de las sesiones futuras?'
      : '¿Confirmar eliminación de este turno?';

    openModal({
      title: mode === 'future' ? 'Eliminar sesiones futuras' : 'Eliminar turno',
      message: confirmMessage,
      confirmText: 'Eliminar',
      danger: true,
      icon: Trash2,
      onConfirm: async () => {
        try {
          setLoading(true);
          await api.delete(`/appointments/${appointment.id}`, {
            params: mode === 'future' ? { deleteFuture: 'true' } : {},
          });
          onDelete();
          onClose();
        } catch {
          alert('Error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const startEditingFutureAppointment = (futureAppointment) => {
    setEditingFutureId(futureAppointment.id);
    setFutureDraft({
      date: getInputDateValue(futureAppointment.date),
      time: futureAppointment.time || '',
    });
  };

  const cancelEditingFutureAppointment = () => {
    setEditingFutureId(null);
    setFutureDraft({ date: '', time: '' });
  };

  const handleFutureAppointmentChange = (field, value) => {
    setFutureDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleFutureAppointmentSave = async (futureAppointment) => {
    if (!futureDraft.date || !futureDraft.time) {
      alert('Debes completar fecha y horario.');
      return;
    }

    try {
      setSavingFutureId(futureAppointment.id);
      await api.put(`/appointments/${futureAppointment.id}`, {
        patientId: appointment.patientId,
        phone: patientData.phone || undefined,
        birthDate: patientData.birthDate || undefined,
        affiliateNumber: patientData.affiliateNumber || undefined,
        date: futureDraft.date,
        time: futureDraft.time,
      });
      await loadFutureAppointments();
      onRefresh?.();
      cancelEditingFutureAppointment();
    } catch (error) {
      alert(error.friendlyMessage || error.response?.data?.message || 'No se pudo reprogramar la sesión.');
    } finally {
      setSavingFutureId('');
    }
  };

  const handleOpenTicket = async () => {
    try {
      setTicketLoading(true);

      if (isEditMode) {
        const { data } = await api.get(`/appointments/${appointment.id}/batch`);
        if (!data?.length) {
          alert('No hay sesiones futuras para imprimir.');
          return;
        }
        setCreatedAppointments(data);
      } else {
        const previewAppointments = projectedSessions.map((session) => ({
          ...session,
          date: format(session.date, 'yyyy-MM-dd'),
        }));

        if (!previewAppointments.length) {
          alert('No hay sesiones para imprimir.');
          return;
        }

        setCreatedAppointments(previewAppointments);
      }

      setCloseAfterPrintPreview(false);
      setShowPrintModal(true);
    } catch (error) {
      alert(error.friendlyMessage || error.response?.data?.message || 'No se pudo generar el ticket.');
    } finally {
      setTicketLoading(false);
    }
  };

  const handlePrintModalClose = () => {
    setShowPrintModal(false);

    if (closeAfterPrintPreview) {
      onSave?.();
      onClose?.();
      setCloseAfterPrintPreview(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col md:flex-row border border-white/20">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO + HISTORIA */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-100 overflow-hidden">
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">{isEditMode ? 'Editar Turno' : 'Nuevo Turno'}</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  {modalDate ? format(new Date(`${modalDate}T12:00:00`), "eeee dd 'de' MMMM", { locale: es }) : ''}
                </p>
                <p className="text-teal-600 text-[10px] font-black uppercase tracking-widest mt-2">
                  {isEditMode ? appointment?.professional?.fullName : professional?.fullName || 'Profesional no seleccionado'}
                </p>
              </div>
              <div className="bg-teal-50 px-5 py-2 rounded-2xl border border-teal-100 text-center">
                <p className="text-teal-600 font-black text-xl leading-none">{modalTime}</p>
                <p className="text-[9px] text-teal-500 font-bold uppercase tracking-widest">Horario</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DNI del Paciente</label>
                  <input className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.dni} onChange={e => {setPatientData({...patientData, dni: e.target.value}); searchPatient('dni', e.target.value);}} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Obra Social</label>
                  <input className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.healthInsurance} onChange={e => setPatientData({...patientData, healthInsurance: e.target.value})} />
                </div>
                <input placeholder="Apellido" className="p-3 border rounded-2xl bg-slate-50 font-bold" value={patientData.lastName} onChange={e => setPatientData({...patientData, lastName: e.target.value})} />
                <input placeholder="Nombre" className="p-3 border rounded-2xl bg-slate-50 font-bold" value={patientData.firstName} onChange={e => setPatientData({...patientData, firstName: e.target.value})} />
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">N° Afiliado</label>
                  <input className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.affiliateNumber || ''} onChange={e => setPatientData({...patientData, affiliateNumber: e.target.value})} />
                </div>
                <div className="col-span-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-3">
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
                      onClick={() => setPatientData((prev) => ({ ...prev, treatAsParticular: !prev.treatAsParticular }))}
                      className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                        patientData.treatAsParticular
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                  <input type="tel" placeholder="+54 9 11 2345-6789" className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.phone || ''} onChange={e => setPatientData({...patientData, phone: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Nacimiento</label>
                  <input type="date" className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.birthDate || ''} onChange={e => setPatientData({...patientData, birthDate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnóstico / Evolución</label>
                <textarea className="w-full p-4 border rounded-2xl bg-slate-50 h-24 outline-none resize-none font-semibold uppercase focus:ring-2 ring-teal-500" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
              </div>

              {isEditMode && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado del Turno</label>
                  <div className="grid grid-cols-3 gap-2">
                    {APPOINTMENT_STATUSES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setStatus(item.value)}
                        className={`rounded-2xl border px-3 py-3 text-[10px] font-black uppercase transition-all ${
                          status === item.value
                            ? item.classes
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isEditMode && (
                <div className="grid grid-cols-2 gap-6 items-center">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Días Semanales</label>
                    <div className="flex gap-1">
                      {WEEK_DAYS.map(day => (
                        <button key={day.value} type="button" onClick={() => setSelectedDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])} className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${selectedDays.includes(day.value) ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>{day.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad Sesiones</label>
                    <input type="number" className="w-full p-2 border rounded-xl bg-slate-50 font-black text-teal-700 text-center" value={sessionCount} onChange={e => setSessionCount(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 grid grid-cols-3 gap-2">
                {[{ key: 'hasCancer', label: 'Oncológico', color: 'accent-red-500' }, { key: 'hasMarcapasos', label: 'Marcapasos', color: 'accent-blue-500' }, { key: 'usesEA', label: 'E.A.', color: 'accent-amber-500' }].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className={`${item.color} w-4 h-4`} checked={patientData[item.key]} onChange={e => setPatientData({...patientData, [item.key]: e.target.checked})} />
                    <span className={`text-[10px] font-black uppercase ${patientData[item.key] ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* HISTORIA CLÍNICA CON SCROLL INDEPENDIENTE */}
              {isEditMode && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={14} className="text-teal-500" /> Cronología de Sesiones</h3>
                  <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar space-y-3 bg-slate-50/50 rounded-[2rem] p-3 border border-slate-100/50">
                    {appointment?.patient?.clinicalHistory?.length > 0 ? (
                      appointment.patient.clinicalHistory.map((h) => (
                        <div key={h.id} className="p-4 border border-slate-100 rounded-[1.8rem] bg-white shadow-sm flex-shrink-0">
                          <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1">
                            <span>{format(new Date(h.date), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                            <span className="text-teal-600 uppercase font-black">{h.professional?.fullName || 'Profesional'}</span>
                          </div>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-tight">{h.diagnosis}</p>
                          <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed">"{h.evolution || 'Sin observación'}"</p>
                        </div>
                      ))
                    ) : <p className="text-[10px] text-slate-300 font-bold italic text-center py-10 uppercase">No hay registros</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8 pb-4">
              <button onClick={onClose} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button>
              <button onClick={handleAction} disabled={loading} className="flex-[2] bg-teal-600 text-white font-black py-4 rounded-3xl shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest">
                {loading ? <Loader2 className="animate-spin" size={18} /> : (isEditMode ? 'Guardar Cambios' : 'Confirmar y Agendar')}
              </button>
            </div>

            {isEditMode && (
              <div className="mt-4 pt-6 border-t border-red-50 grid grid-cols-2 gap-3 pb-8">
                <button onClick={() => handleDelete('single')} className="py-3 bg-red-50 text-red-600 font-black rounded-2xl text-[9px] uppercase hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Trash2 size={14} /> Solo hoy</button>
                <button onClick={() => handleDelete('future')} className="py-3 bg-red-600 text-white font-black rounded-2xl text-[9px] uppercase hover:bg-red-700 shadow-md transition-all flex items-center justify-center gap-2"><Trash2 size={14} /> Sesiones futuras</button>
              </div>
            )}
          </div>
        </div>
        
        {/* COLUMNA DERECHA: SESIONES */}
        <div className="w-full md:w-80 bg-slate-50 p-8 flex flex-col">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-200 pb-2">
             <CalendarIcon size={14} className="text-teal-500" /> 
             {isEditMode ? `${futureAppointments.length} Sesiones Futuras` : `${projectedSessions.length} Proyectadas`}
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(isEditMode ? futureAppointments : projectedSessions).map((apt, idx) => {
              const displaySessionNumber = apt.sessionNumber || idx + 1;

              return (
              <div
                key={apt.id || idx}
                className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-teal-300 ${
                  editingFutureId === apt.id ? 'space-y-3' : 'flex justify-between items-center'
                }`}
              >
                {editingFutureId === apt.id ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
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
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase text-slate-400 transition-all hover:border-slate-300"
                      >
                        <X size={12} />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFutureAppointmentSave(apt)}
                        disabled={savingFutureId === apt.id}
                        className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-teal-700"
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
                        Sesión {displaySessionNumber}
                      </p>
                      <span className="text-[11px] font-bold text-slate-700">{format(new Date(apt.date), "dd 'de' MMMM", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">{apt.time} hs</span>
                      {isEditMode && apt.id && (
                        <button
                          type="button"
                          onClick={() => startEditingFutureAppointment(apt)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all hover:border-teal-400 hover:text-teal-600"
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
            className="mt-6 w-full py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:border-teal-500 hover:text-teal-600 transition-all shadow-sm"
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
