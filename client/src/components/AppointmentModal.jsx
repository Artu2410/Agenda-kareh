import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, Printer, Loader2, Trash2, History, Pencil, Check, X, Flag, Plus, Banknote } from 'lucide-react';
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
  { value: 'PENDING_AUTHORIZATION', label: 'Pend. autorización', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'AUTHORIZED', label: 'Autorizado', classes: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'REJECTED', label: 'Rechazado', classes: 'bg-rose-100 text-rose-700 border-rose-200' },
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
const PARTICULAR_OPTION_VALUE = '__PARTICULAR__';

const formatCurrency = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
}).format(Number(value || 0));

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

const isUnknownBirthDate = (birthDate) => {
  if (!birthDate) return true;
  const dateString = birthDate.includes('T') ? birthDate.split('T')[0] : birthDate;
  return dateString <= UNKNOWN_BIRTHDATE;
};

const AppointmentModal = ({ isOpen, onClose, onSave, onDelete, onRefresh, selectedSlot, appointment = null, professional = null }) => {
  const [patientData, setPatientData] = useState({
    dni: '', lastName: '', firstName: '', phone: '', birthDate: '',
    healthInsurance: '', obraSocialId: '', treatAsParticular: false, affiliateNumber: '',
    hasCancer: false, hasMarcapasos: false, usesEA: false,
    usesWheelchair: false, isRespiratory: false,
  });

  const [diagnosis, setDiagnosis] = useState('');
  const [status, setStatus] = useState('SCHEDULED');
  const [isFirstSession, setIsFirstSession] = useState(false);
  const [sessionCount, setSessionCount] = useState(10);
  const [selectedDays, setSelectedDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [createdAppointments, setCreatedAppointments] = useState([]);
  const [futureAppointments, setFutureAppointments] = useState([]);
  const [sessionCycles, setSessionCycles] = useState([]);
  const [editingFutureId, setEditingFutureId] = useState(null);
  const [futureDraft, setFutureDraft] = useState({ date: '', time: '' });
  const [savingFutureId, setSavingFutureId] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [closeAfterPrintPreview, setCloseAfterPrintPreview] = useState(false);
  const [isAddingManualSession, setIsAddingManualSession] = useState(false);
  const [manualDraft, setManualDraft] = useState({ date: '', time: '' });
  const [obrasSociales, setObrasSociales] = useState([]);
  const [documentsChecklist, setDocumentsChecklist] = useState({ documents: [], additionalInfo: '' });
  const [authorizationNumber, setAuthorizationNumber] = useState('');
  const [authorizationFileUrl, setAuthorizationFileUrl] = useState('');
  const [paidInAdvance, setPaidInAdvance] = useState(false);
  const [uploadingAuthorization, setUploadingAuthorization] = useState(false);

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

  const loadSessionCycles = useCallback(async () => {
    if (!appointment?.patientId) {
      setSessionCycles([]);
      return;
    }
    try {
      const { data } = await api.get(`/patients/${appointment.patientId}/session-cycles`);
      setSessionCycles(data || []);
    } catch (error) {
      console.error(error);
    }
  }, [appointment?.patientId]);

  const loadObrasSociales = useCallback(async () => {
    try {
      const { data } = await api.get('/obras-sociales', {
        params: { includeInactive: '1', includeArchived: '1' },
      });
      setObrasSociales(data || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

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

  // En edit mode: proyectar las sesiones adicionales a generar basándose en modalDate
  const projectedEditSessions = useMemo(() => {
    if (!isEditMode) return [];
    if (selectedDays.length === 0 || !modalDate) return [];
    const sessions = [];
    const [year, month, day] = modalDate.split('-').map(Number);
    // Arrancar desde el día siguiente al turno actual para no duplicar
    let currentDate = new Date(year, month - 1, day + 1, 12, 0, 0);
    const count = parseInt(sessionCount) || 0;
    let safety = 0;
    while (sessions.length < count && safety < 200) {
      safety++;
      if (selectedDays.includes(currentDate.getDay())) {
        sessions.push({ date: new Date(currentDate), time: modalTime });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return sessions;
  }, [selectedDays, sessionCount, modalDate, modalTime, isEditMode]);

  const selectedObraSocial = useMemo(() => {
    if (patientData.obraSocialId) {
      return obrasSociales.find((obraSocial) => obraSocial.id === patientData.obraSocialId) || null;
    }

    return obrasSociales.find((obraSocial) => obraSocial.nombreOs === patientData.healthInsurance) || null;
  }, [obrasSociales, patientData.healthInsurance, patientData.obraSocialId]);

  const patientChargeBreakdown = useMemo(() => {
    if (!selectedObraSocial || patientData.treatAsParticular) {
      return {
        total: 0,
        baseCopay: 0,
        percentageAmount: 0,
        fixedCopay: 0,
      };
    }

    const honorario = Number(selectedObraSocial.honorarioEstimado || 0);
    const percentage = Number(selectedObraSocial.percentageCoinsurance || 0);
    const baseCopay = Number(selectedObraSocial.coseguroValor || 0);
    const fixedCopay = Number(selectedObraSocial.fixedCopay || 0);
    const percentageAmount = percentage > 0 ? (honorario * percentage) / 100 : 0;

    return {
      baseCopay,
      percentageAmount,
      fixedCopay,
      total: baseCopay + percentageAmount + fixedCopay,
    };
  }, [patientData.treatAsParticular, selectedObraSocial]);

  const selectedCoverageValue = useMemo(() => {
    if (patientData.treatAsParticular) {
      return PARTICULAR_OPTION_VALUE;
    }

    return patientData.obraSocialId || '';
  }, [patientData.obraSocialId, patientData.treatAsParticular]);

  useEffect(() => {
    if (!isOpen) return;
    loadObrasSociales();
  }, [isOpen, loadObrasSociales]);

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
        obraSocialId: p.obraSocialId || '',
        treatAsParticular: p.treatAsParticular || false,
        affiliateNumber: p.affiliateNumber || '',
        hasCancer: p.hasCancer || false,
        hasMarcapasos: p.hasMarcapasos || false,
        usesEA: p.usesEA || false,
        usesWheelchair: p.usesWheelchair || false,
        isRespiratory: p.isRespiratory || false,
      });
      setDiagnosis(appointment.diagnosis || '');
      setStatus(appointment.status || 'SCHEDULED');
      setIsFirstSession(appointment.isFirstSession || false);
      setDocumentsChecklist(appointment.documentsChecklist || { documents: [], additionalInfo: '' });
      setAuthorizationNumber(appointment.authorizationNumber || '');
      setAuthorizationFileUrl(appointment.authorizationFileUrl || '');
      setPaidInAdvance(Boolean(appointment.paidInAdvance));
      setEditingFutureId(null);
      setFutureDraft({ date: '', time: '' });
      setIsAddingManualSession(false);
      setManualDraft({ date: '', time: '' });

      const [y, m, d] = (getInputDateValue(appointment.date) || '').split('-').map(Number);
      if (y && m && d) {
        setSelectedDays([new Date(y, m - 1, d, 12, 0, 0).getDay()]);
      } else {
        setSelectedDays([]);
      }
      setSessionCount(9);

      loadFutureAppointments();
      loadSessionCycles();
    } else {
      setPatientData({
        dni: '', lastName: '', firstName: '', phone: '', birthDate: '',
        healthInsurance: '', obraSocialId: '', treatAsParticular: false, affiliateNumber: '',
        hasCancer: false, hasMarcapasos: false, usesEA: false,
        usesWheelchair: false, isRespiratory: false,
      });
      setDiagnosis('');
      setStatus('SCHEDULED');
      setIsFirstSession(true);
      setDocumentsChecklist({ documents: [], additionalInfo: '' });
      setAuthorizationNumber('');
      setAuthorizationFileUrl('');
      setPaidInAdvance(false);
      setSessionCount(10);
      setFutureAppointments([]);
      setEditingFutureId(null);
      setFutureDraft({ date: '', time: '' });
      setIsAddingManualSession(false);
      setManualDraft({ date: '', time: '' });
      if (selectedSlot) {
        const [y, m, d] = selectedSlot.date.split('-').map(Number);
        setSelectedDays([new Date(y, m - 1, d, 12, 0, 0).getDay()]);
      }
    }
  }, [isOpen, isEditMode, appointment, selectedSlot, loadFutureAppointments]);

  useEffect(() => {
    if (!selectedObraSocial || patientData.treatAsParticular) {
      setDocumentsChecklist({ documents: [], additionalInfo: '' });
      return;
    }

    const nextChecklist = isEditMode
      ? buildChecklistFromInsurance(selectedObraSocial, appointment?.documentsChecklist || null)
      : buildChecklistFromInsurance(selectedObraSocial, null);

    setDocumentsChecklist(nextChecklist);
  }, [appointment?.documentsChecklist, isEditMode, patientData.treatAsParticular, selectedObraSocial]);

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
          obraSocialId: data.obraSocialId || '',
          treatAsParticular: data.treatAsParticular || false,
          affiliateNumber: data.affiliateNumber || '',
          hasCancer: data.hasCancer || false,
          hasMarcapasos: data.hasMarcapasos || false,
          usesEA: data.usesEA || false,
          usesWheelchair: data.usesWheelchair || false,
          isRespiratory: data.isRespiratory || false,
        }));
      }
    } catch {
      // Si no existe el paciente todavía, dejamos el formulario para alta manual.
    }
  }, []);

  const uploadDocumentToStorage = async (file, scope = 'appointment-documents') => {
    const payload = new FormData();
    payload.append('file', file);
    payload.append('scope', scope);
    if (appointment?.id) payload.append('entryId', appointment.id);
    if (appointment?.patientId) payload.append('patientId', appointment.patientId);
    if (appointment?.professionalId || professional?.id) payload.append('professionalId', appointment?.professionalId || professional?.id);

    const response = await api.post('/uploads', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data?.url || '';
  };

  const handleAuthorizationFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setUploadingAuthorization(true);
      const fileUrl = await uploadDocumentToStorage(file, 'appointment-authorization');
      setAuthorizationFileUrl(fileUrl);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'No se pudo subir el archivo de autorización.');
    } finally {
      setUploadingAuthorization(false);
    }
  };

  const handleAction = async () => {
    setLoading(true);
    const fullName = `${patientData.lastName} ${patientData.firstName}`.trim();
    try {
      const payload = {
        diagnosis,
        status,
        documentsChecklist,
        authorizationNumber,
        authorizationFileUrl,
        paidInAdvance,
        isFirstSession,
        patientData: {
          ...patientData,
          fullName,
          birthDate: patientData.birthDate ? new Date(patientData.birthDate).toISOString() : null
        }
      };
      if (isEditMode) {
        await api.patch(`/appointments/${appointment.id}/evolution`, payload);
        await onSave?.();
        await loadFutureAppointments();
        await loadSessionCycles();
        onRefresh?.(); // Asegurar refresco total de la agenda
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

  const handleCreateIndividualSession = async () => {
    if (!manualDraft.date || !manualDraft.time) {
      alert('Debes completar fecha y horario.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/appointments', {
        patientId: appointment.patientId,
        professionalId: appointment.professionalId || professional?.id,
        date: manualDraft.date,
        time: manualDraft.time,
        diagnosis,
        status: 'SCHEDULED',
        documentsChecklist,
        authorizationNumber,
        authorizationFileUrl,
        paidInAdvance: false,
        sessionCount: 1,
        selectedDays: []
      });
      await loadFutureAppointments();
      onRefresh?.();
      setIsAddingManualSession(false);
      setManualDraft({ date: '', time: '' });
    } catch (error) {
      alert(error.response?.data?.message || 'Error al agendar la sesión individual.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAdditionalSessions = async () => {
    if (!selectedDays.length || sessionCount <= 0) {
      alert("Selecciona días y la cantidad de sesiones a generar.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        patientId: appointment.patientId,
        professionalId: appointment.professionalId || professional?.id,
        date: modalDate,
        time: modalTime,
        status,
        documentsChecklist,
        authorizationNumber,
        authorizationFileUrl,
        paidInAdvance: false,
        sessionCount: parseInt(sessionCount) || 1,
        selectedDays
      };
      await api.post('/appointments', payload);
      await loadFutureAppointments();
      onRefresh?.();
      alert("Sesiones adicionales generadas exitosamente.");
    } catch (error) {
      alert(error.response?.data?.message || "Error al generar sesiones adicionales.");
    } finally {
      setLoading(false);
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
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center z-999 p-4">
      <div className="bg-white rounded-4xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col md:flex-row border border-white/20">

        {/* COLUMNA IZQUIERDA: FORMULARIO + HISTORIA */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-100 overflow-hidden">
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">
                  {isEditMode
                    ? `Sesión ${isFirstSession ? '1' : (appointment.sessionNumber || '')}${isFirstSession ? ' (Ingreso)' : ''}`
                    : 'Nuevo Turno'}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    {modalDate ? format(new Date(`${modalDate}T12:00:00`), "eeee dd 'de' MMMM", { locale: es }) : ''}
                  </p>
                  {isEditMode && !isFirstSession && (
                    <button
                      type="button"
                      onClick={() => setIsFirstSession(true)}
                      className="bg-rose-50 text-rose-600 border border-rose-100 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase hover:bg-rose-100 transition-all flex items-center gap-1"
                    >
                      <Flag size={9} fill="currentColor" /> Reiniciar Ciclo (Sesión 1)
                    </button>
                  )}
                  {isEditMode && isFirstSession && (
                    <span className="flex items-center gap-1 bg-teal-50 text-teal-600 border border-teal-100 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase anima-pulse">
                      <Check size={10} /> Inicio de Ciclo
                    </span>
                  )}
                  {paidInAdvance && (
                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase">
                      <Banknote size={10} /> Pago adelantado
                    </span>
                  )}
                </div>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DNI del Paciente</label>
                  <input className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.dni} onChange={e => { setPatientData({ ...patientData, dni: e.target.value }); searchPatient('dni', e.target.value); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Obra Social</label>
                  <select
                    className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none"
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
                <input placeholder="Apellido" className="p-3 border rounded-2xl bg-slate-50 font-bold" value={patientData.lastName} onChange={e => setPatientData({ ...patientData, lastName: e.target.value })} />
                <input placeholder="Nombre" className="p-3 border rounded-2xl bg-slate-50 font-bold" value={patientData.firstName} onChange={e => setPatientData({ ...patientData, firstName: e.target.value })} />
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">N° Afiliado</label>
                  <input className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.affiliateNumber || ''} onChange={e => setPatientData({ ...patientData, affiliateNumber: e.target.value })} />
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
                      className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${patientData.treatAsParticular
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
                      className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
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
                  <div className="sm:col-span-2 rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-amber-800">
                    Esta obra social se encuentra inactiva. No se podrán generar nuevos turnos hasta reactivarla o cambiar la cobertura del paciente.
                  </div>
                )}

                {!!selectedObraSocial && !patientData.treatAsParticular && (
                  <div className="sm:col-span-2 rounded-[1.6rem] border border-teal-100 bg-teal-50/70 px-4 py-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-teal-600">Coseguro calculado</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                  <input type="tel" placeholder="+54 9 11 2345-6789" className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.phone || ''} onChange={e => setPatientData({ ...patientData, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Nacimiento</label>
                  <input type="date" className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.birthDate || ''} onChange={e => setPatientData({ ...patientData, birthDate: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnóstico / Evolución</label>
                <textarea className="w-full p-4 border rounded-2xl bg-slate-50 h-24 outline-none resize-none font-semibold uppercase focus:ring-2 ring-teal-500" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
              </div>

              {isEditMode && (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado del Turno</label>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                      {APPOINTMENT_STATUSES.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setStatus(item.value)}
                          className={`rounded-2xl border px-3 py-3 text-[10px] font-black uppercase transition-all ${status === item.value
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
                </>
              )}

              {(!isEditMode || futureAppointments.length <= 1) && (
                <div className="grid grid-cols-2 gap-6 items-center border border-slate-100 rounded-3xl p-4 bg-slate-50/50">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Días Semanales</label>
                    <div className="flex gap-1">
                      {WEEK_DAYS.map(day => (
                        <button key={day.value} type="button" onClick={() => setSelectedDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])} className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${selectedDays.includes(day.value) ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>{day.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 flex flex-col justify-center">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{isEditMode ? 'Generar más sesiones' : 'Cantidad Sesiones'}</label>
                    <div className="flex gap-2 items-center">
                      <input type="number" className="w-16 p-2 border rounded-xl bg-white font-black text-teal-700 text-center shadow-sm" value={sessionCount} onChange={e => setSessionCount(e.target.value)} />
                      {isEditMode && (
                        <button
                          type="button"
                          onClick={handleGenerateAdditionalSessions}
                          disabled={loading}
                          className="px-4 py-2 bg-teal-100 text-teal-700 font-black rounded-xl text-[9px] uppercase hover:bg-teal-200 transition-all"
                        >
                          Generar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-4xl border border-slate-100 grid grid-cols-3 gap-2">
                {[
                  { key: 'hasCancer', label: 'Oncológico', color: 'accent-red-500' },
                  { key: 'hasMarcapasos', label: 'Marcapasos', color: 'accent-blue-500' },
                  { key: 'usesEA', label: 'E.A.', color: 'accent-amber-500' },
                  { key: 'usesWheelchair', label: 'Silla Ruedas 🦽', color: 'accent-slate-600' },
                  { key: 'isRespiratory', label: 'Respiratorio 🫁', color: 'accent-rose-500' }
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
            </div>

            <div className="flex gap-4 mt-8 pb-4">
              <button onClick={onClose} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button>
              <button onClick={handleAction} disabled={loading} className="flex-2 bg-teal-600 text-white font-black py-4 rounded-3xl shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest">
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
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center justify-between border-b border-slate-200 pb-2">
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
                className="p-1 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                title="Agregar sesión individual"
              >
                <Plus size={16} />
              </button>
            )}
          </h3>

          {isAddingManualSession && (
            <div className="mb-4 bg-teal-50/50 p-3 rounded-xl border border-teal-100 space-y-3 animate-in fade-in slide-in-from-top-2">
              <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Nueva sesión individual</p>
              <div className="grid grid-cols-2 gap-2">
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
                  className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateIndividualSession}
                  disabled={loading}
                  className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-teal-700"
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
