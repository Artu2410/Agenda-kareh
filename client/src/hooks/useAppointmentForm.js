import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flag, Trash2 } from 'lucide-react';
import api from '../services/api';
import { resolveCoveragePayload, resolveCoverageSelectionId } from '../utils/coverage';
import { useConfirmModal } from './useConfirmModal';

const UNKNOWN_BIRTHDATE = '1900-01-01';
const PARTICULAR_OPTION_VALUE = '__PARTICULAR__';

const getInputDateValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return format(new Date(value), 'yyyy-MM-dd');
};

const isUnknownBirthDate = (birthDate) => {
  if (!birthDate) return true;
  const dateString = birthDate.includes('T') ? birthDate.split('T')[0] : birthDate;
  return dateString <= UNKNOWN_BIRTHDATE;
};

const createPatientData = () => ({
  dni: '',
  lastName: '',
  firstName: '',
  phone: '',
  birthDate: '',
  healthInsurance: '',
  obraSocialId: '',
  treatAsParticular: false,
  affiliateNumber: '',
  hasCancer: false,
  hasMarcapasos: false,
  usesEA: false,
  usesWheelchair: false,
  isRespiratory: false,
  isIU: false,
});

const createManualDraft = () => ({ date: '', time: '' });

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

const normalizePatientFromAppointment = (appointment) => {
  const patient = appointment?.patient || {};
  const nameParts = String(patient.fullName || '').split(' ');

  return {
    dni: patient.dni || '',
    lastName: nameParts[0] || '',
    firstName: nameParts.slice(1).join(' ') || '',
    phone: patient.phone || '',
    birthDate: patient.birthDate && !isUnknownBirthDate(patient.birthDate) ? patient.birthDate.split('T')[0] : '',
    healthInsurance: patient.healthInsurance || '',
    obraSocialId: patient.obraSocialId || '',
    treatAsParticular: patient.treatAsParticular || false,
    affiliateNumber: patient.affiliateNumber || '',
    hasCancer: patient.hasCancer || false,
    hasMarcapasos: patient.hasMarcapasos || false,
    usesEA: patient.usesEA || false,
    usesWheelchair: patient.usesWheelchair || false,
    isRespiratory: patient.isRespiratory || false,
    isIU: patient.isIU || false,
  };
};

const normalizePatientFromSearch = (previousPatient, data) => {
  const nameParts = String(data.fullName || '').split(' ');

  return {
    ...previousPatient,
    lastName: nameParts[0] || '',
    firstName: nameParts.slice(1).join(' ') || '',
    dni: data.dni || previousPatient.dni,
    phone: data.phone || '',
    birthDate: data.birthDate && !isUnknownBirthDate(data.birthDate) ? data.birthDate.split('T')[0] : previousPatient.birthDate,
    healthInsurance: data.healthInsurance || '',
    obraSocialId: data.obraSocialId || '',
    treatAsParticular: data.treatAsParticular || false,
    affiliateNumber: data.affiliateNumber || '',
    hasCancer: data.hasCancer || false,
    hasMarcapasos: data.hasMarcapasos || false,
    usesEA: data.usesEA || false,
    usesWheelchair: data.usesWheelchair || false,
    isRespiratory: data.isRespiratory || false,
    isIU: data.isIU || false,
  };
};

export const useAppointmentForm = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onRefresh,
  selectedSlot,
  appointment = null,
  professional = null,
}) => {
  const [patientData, setPatientData] = useState(createPatientData);
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
  const [futureDraft, setFutureDraft] = useState(createManualDraft);
  const [savingFutureId, setSavingFutureId] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [closeAfterPrintPreview, setCloseAfterPrintPreview] = useState(false);
  const [isAddingManualSession, setIsAddingManualSession] = useState(false);
  const [manualDraft, setManualDraft] = useState(createManualDraft);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [documentsChecklist, setDocumentsChecklist] = useState({ documents: [], additionalInfo: '' });
  const [authorizationNumber, setAuthorizationNumber] = useState('');
  const [authorizationFileUrl, setAuthorizationFileUrl] = useState('');
  const [paidInAdvance, setPaidInAdvance] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [uploadingAuthorization, setUploadingAuthorization] = useState(false);

  const lastSearchedRef = useRef('');
  const { ConfirmModalComponent, openModal } = useConfirmModal();

  const isEditMode = Boolean(appointment?.id);
  const modalDate = selectedSlot?.date || getInputDateValue(appointment?.date);
  const modalTime = selectedSlot?.time || appointment?.time || '';
  const originalIsFirstSession = Boolean(appointment?.isFirstSession);
  const hasSessionBoundaryChange = isEditMode && originalIsFirstSession !== isFirstSession;
  const isPendingCycleReset = isEditMode && !originalIsFirstSession && isFirstSession;

  const loadFutureAppointments = useCallback(async () => {
    if (!appointment?.patientId) {
      setFutureAppointments([]);
      return;
    }

    try {
      const { data } = await api.get(`/patients/${appointment.patientId}/future-appointments`);
      setFutureAppointments(data || []);
    } catch {
      return;
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
    } catch {
      return;
    }
  }, [appointment?.patientId]);

  const loadObrasSociales = useCallback(async () => {
    try {
      const { data } = await api.get('/obras-sociales', {
        params: { includeInactive: '1', includeArchived: '1' },
      });
      setObrasSociales(data || []);
    } catch {
      return;
    }
  }, []);

  const projectedSessions = useMemo(() => {
    if (isEditMode) return [];
    if (selectedDays.length === 0 || !selectedSlot?.date) return [];

    const sessions = [];
    const [year, month, day] = selectedSlot.date.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day, 12, 0, 0);
    const count = Number.parseInt(sessionCount, 10) || 0;

    while (sessions.length < count && sessions.length < 60) {
      if (selectedDays.includes(currentDate.getDay())) {
        sessions.push({ date: new Date(currentDate), time: selectedSlot.time });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return sessions;
  }, [selectedDays, sessionCount, selectedSlot, isEditMode]);

  const projectedEditSessions = useMemo(() => {
    if (!isEditMode) return [];
    if (selectedDays.length === 0 || !modalDate) return [];

    const sessions = [];
    const [year, month, day] = modalDate.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day + 1, 12, 0, 0);
    const count = Number.parseInt(sessionCount, 10) || 0;
    let safety = 0;

    while (sessions.length < count && safety < 200) {
      safety += 1;
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

    return resolveCoverageSelectionId(patientData, selectedObraSocial);
  }, [patientData, selectedObraSocial]);

  useEffect(() => {
    if (!isOpen) return;
    loadObrasSociales();
  }, [isOpen, loadObrasSociales]);

  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode && appointment) {
      setPatientData(normalizePatientFromAppointment(appointment));
      setDiagnosis(appointment.diagnosis || '');
      setStatus(appointment.status || 'SCHEDULED');
      setIsFirstSession(appointment.isFirstSession || false);
      setDocumentsChecklist(appointment.documentsChecklist || { documents: [], additionalInfo: '' });
      setAuthorizationNumber(appointment.authorizationNumber || '');
      setAuthorizationFileUrl(appointment.authorizationFileUrl || '');
      setPaidInAdvance(Boolean(appointment.paidInAdvance));
      setSessionToken(appointment.sessionToken || '');
      setEditingFutureId(null);
      setFutureDraft(createManualDraft());
      setIsAddingManualSession(false);
      setManualDraft(createManualDraft());

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
      setPatientData(createPatientData());
      setDiagnosis('');
      setStatus('SCHEDULED');
      setIsFirstSession(true);
      setDocumentsChecklist({ documents: [], additionalInfo: '' });
      setAuthorizationNumber('');
      setAuthorizationFileUrl('');
      setPaidInAdvance(false);
      setSessionToken('');
      setSessionCount(10);
      setFutureAppointments([]);
      setEditingFutureId(null);
      setFutureDraft(createManualDraft());
      setIsAddingManualSession(false);
      setManualDraft(createManualDraft());
      if (selectedSlot) {
        const [y, m, d] = selectedSlot.date.split('-').map(Number);
        setSelectedDays([new Date(y, m - 1, d, 12, 0, 0).getDay()]);
      }
    }
  }, [isOpen, isEditMode, appointment, selectedSlot, loadFutureAppointments, loadSessionCycles]);

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
        setPatientData((previous) => normalizePatientFromSearch(previous, data));
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
      alert(error?.response?.data?.message || 'No se pudo subir el archivo de autorización.');
    } finally {
      setUploadingAuthorization(false);
    }
  };

  const confirmSessionBoundaryChange = useCallback(() => new Promise((resolve) => {
    const appointmentDateLabel = modalDate
      ? format(new Date(`${modalDate}T12:00:00`), 'dd/MM', { locale: es })
      : 'seleccionada';

    openModal({
      title: isPendingCycleReset ? 'Reiniciar ciclo' : 'Quitar inicio de ciclo',
      message: isPendingCycleReset
        ? `La sesión del ${appointmentDateLabel} pasará a ser la nueva sesión 1 y se renumerarán las sesiones siguientes de este paciente. ¿Deseas continuar?`
        : `La sesión del ${appointmentDateLabel} dejará de ser inicio de ciclo y se renumerarán las sesiones siguientes de este paciente. ¿Deseas continuar?`,
      confirmText: isPendingCycleReset ? 'Reiniciar ciclo' : 'Guardar cambio',
      cancelText: 'Cancelar',
      danger: true,
      icon: Flag,
      onConfirm: async () => resolve(true),
      onCancel: () => resolve(false),
    });
  }), [isPendingCycleReset, modalDate, openModal]);

  const handleAction = async () => {
    const fullName = `${patientData.lastName} ${patientData.firstName}`.trim();
    if (hasSessionBoundaryChange) {
      const confirmed = await confirmSessionBoundaryChange();
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const normalizedCoverage = resolveCoveragePayload(patientData, selectedObraSocial);
      const payload = {
        diagnosis,
        status,
        documentsChecklist,
        authorizationNumber,
        authorizationFileUrl,
        paidInAdvance,
        sessionToken,
        isFirstSession,
        patientData: {
          ...patientData,
          ...normalizedCoverage,
          fullName,
          birthDate: patientData.birthDate ? new Date(patientData.birthDate).toISOString() : null,
        },
      };

      if (isEditMode) {
        await api.patch(`/appointments/${appointment.id}/evolution`, payload);
        await onSave?.();
        await loadFutureAppointments();
        await loadSessionCycles();
        onRefresh?.();
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
          selectedDays,
        };
        const { data } = await api.post('/appointments', fullPayload);
        setCreatedAppointments(data.appointments || []);
        setCloseAfterPrintPreview(true);
        setShowPrintModal(true);
        onRefresh?.();
      }
    } catch {
      alert('Error');
    } finally {
      setLoading(false);
    }
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
    setFutureDraft(createManualDraft());
  };

  const handleFutureAppointmentChange = (field, value) => {
    setFutureDraft((previous) => ({ ...previous, [field]: value }));
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
        sessionToken,
        sessionCount: 1,
        selectedDays: [],
      });
      await loadFutureAppointments();
      onRefresh?.();
      setIsAddingManualSession(false);
      setManualDraft(createManualDraft());
    } catch (error) {
      alert(error.response?.data?.message || 'Error al agendar la sesión individual.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAdditionalSessions = async () => {
    if (!selectedDays.length || sessionCount <= 0) {
      alert('Selecciona días y la cantidad de sesiones a generar.');
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
        sessionToken,
        sessionCount: Number.parseInt(sessionCount, 10) || 1,
        selectedDays,
      };
      await api.post('/appointments', payload);
      await loadFutureAppointments();
      onRefresh?.();
      alert('Sesiones adicionales generadas exitosamente.');
    } catch (error) {
      alert(error.response?.data?.message || 'Error al generar sesiones adicionales.');
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

  return {
    ConfirmModalComponent,
    isEditMode,
    modalDate,
    modalTime,
    originalIsFirstSession,
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
    closeAfterPrintPreview,
    isAddingManualSession,
    manualDraft,
    obrasSociales,
    documentsChecklist,
    setDocumentsChecklist,
    authorizationNumber,
    setAuthorizationNumber,
    authorizationFileUrl,
    setAuthorizationFileUrl,
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
    setEditingFutureId,
    setFutureDraft,
  };
};

export default useAppointmentForm;
