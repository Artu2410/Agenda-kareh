import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Save, FileText, Eye, EyeOff, Trash2, AlertTriangle, PlusCircle,
  Loader, X, Upload, Camera, Printer, Calendar, CheckCircle2, ChevronLeft, Search, Maximize2, Receipt
} from 'lucide-react';
import api from '../services/api';
import { getAuthenticatedFileUrl } from '../services/fileUrl';
import toast from 'react-hot-toast';
import { useConfirmModal } from '../hooks/useConfirmModal';
import {
  APP_ROUTES,
  persistClinicalHistoryContext,
  readClinicalHistoryContext,
} from '../utils/appRoutes';
import { getCoverageLabel, isParticularCoverage } from '../utils/coverage';
import { formatPatientAge } from '../utils/patientAge';
import RichTextEditor from '../components/clinical/RichTextEditor';
import KinesicReportModal from '../components/documents/KinesicReportModal';
import PatientReceiptModal from '../components/documents/PatientReceiptModal';
import PatientReportsSection from '../components/documents/PatientReportsSection';
import PatientReceiptsSection from '../components/documents/PatientReceiptsSection';
import {
  isClinicalRichTextEmpty,
  normalizeClinicalRichTextHtml,
} from '../utils/clinicalRichText';
import {
  buildAbandonMessagesByEntry,
  buildProfessionalSignature,
  findCycleForDate,
  describeEntryAppointment,
  findAutoFixableEntries,
  findDiagnosisForDate,
  findEntryDateMismatch,
  findMissingIntakes,
  pickNewEntryDate,
  resolveEntryProfessional,
  todayDateKey,
} from '../utils/clinicalHistoryCycles';
import { buildClinicalHistoryPrintHtml, escapePrintHtml } from '../utils/clinicalHistoryPrint';

const NEW_ENTRY_TEMPLATE = '<p><strong>Anamnesis:</strong></p><p><br></p><p><strong>Estado Funcional:</strong></p><p><br></p><p><strong>Tto:</strong></p>';

const formatDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : dateKey;
};

const formatClinicalRecordNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) return 'Pendiente';
  return `HC ${String(numericValue).padStart(4, '0')}`;
};

/** Firma al pie de cada ficha: profesional que atiende y sus matrículas. */
const ProfessionalSignature = ({ signature }) => {
  if (!signature) return null;
  return (
    <div className="border-t border-slate-100 pt-3 text-right">
      <p className="text-[12px] font-black text-slate-800">{signature.name}</p>
      {signature.licenses && (
        <p className="text-[11px] font-bold text-slate-500">{signature.licenses}</p>
      )}
    </div>
  );
};

const ClinicalHistoryPage = () => {
  const { legacyPatientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const [patient, setPatient] = useState(null);
  const [openDocument, setOpenDocument] = useState(null); // 'report' | 'receipt' | null
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);
  const [editingReport, setEditingReport] = useState(null);
  const [receiptsRefreshKey, setReceiptsRefreshKey] = useState(0);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [sessionCycles, setSessionCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateSearch, setDateSearch] = useState('');

  const timers = useRef({});
  const historyEntriesRef = useRef([]);
  const inFlightSaveClientKeysRef = useRef(new Set());
  const pendingResaveClientKeysRef = useRef(new Set());
  const pendingAutoFixRef = useRef([]);
  const storedHistoryContext = readClinicalHistoryContext();
  const activePatientId = location.state?.patientId || storedHistoryContext?.patientId || legacyPatientId || null;

  useEffect(() => {
    if (location.state?.patientId) {
      persistClinicalHistoryContext({
        patientId: location.state.patientId,
        patientName: location.state.patientName || '',
      });
    }
  }, [location.state]);

  useEffect(() => {
    historyEntriesRef.current = historyEntries;
  }, [historyEntries]);

  useEffect(() => () => {
    Object.values(timers.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    timers.current = {};
  }, []);

  // --- 1. FUNCIONES DE APOYO ---

  const UNKNOWN_BIRTHDATE = '1900-01-01';
  const MAX_UPLOAD_MB = Number(import.meta.env.VITE_UPLOAD_MAX_MB || 25);
  const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

  const isUnknownBirthDate = (birthDate) => {
    if (!birthDate) return true;
    const dateString = birthDate.includes('T') ? birthDate.split('T')[0] : birthDate;
    return dateString <= UNKNOWN_BIRTHDATE;
  };

  // Bebés: meses o días en lugar de "0 años".
  const calculateAge = (birthDate) => {
    if (!birthDate || isUnknownBirthDate(birthDate)) return '...';
    return formatPatientAge(birthDate) || 'N/A';
  };

  const ensureArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try { return JSON.parse(data) || []; } catch { return []; }
  };

  const getAttachmentUrl = (file) => getAuthenticatedFileUrl(file?.url || file?.data || '');

  const isPdfAttachment = (file) => {
    const url = getAttachmentUrl(file);
    if (file?.type === 'application/pdf') return true;
    if (url.startsWith('data:application/pdf')) return true;
    return url.toLowerCase().endsWith('.pdf');
  };

  const isImageAttachment = (file) => {
    const url = getAttachmentUrl(file);
    if (file?.type?.startsWith('image/')) return true;
    if (url.startsWith('data:image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
  };

  const getAttachmentLabel = (file) => {
    if (file?.name) return file.name;
    const url = getAttachmentUrl(file);
    if (!url) return 'Archivo';
    const cleanUrl = url.split('?')[0];
    return cleanUrl.split('/').pop() || 'Archivo';
  };

  const openAttachment = (file) => {
    const url = getAttachmentUrl(file);
    if (!url) return;
    if (url.startsWith('data:')) {
      try {
        const [meta, data] = url.split(',');
        const mime = meta.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      } catch {
        return;
      }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const createEntryClientKey = useCallback(() => (
    globalThis.crypto?.randomUUID?.() || `history-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  ), []);

  const normalizeEntryState = useCallback((entry, fallbackClientKey = null) => ({
    ...entry,
    clientKey: entry?.clientKey || fallbackClientKey || String(entry?.id || createEntryClientKey()),
    attachments: ensureArray(entry?.attachments),
    date: (entry?.date || entry?.createdAt || new Date().toISOString()).split('T')[0],
    evolution: normalizeClinicalRichTextHtml(entry?.evolution || ''),
    status: entry?.status || 'saved',
    isVisible: entry?.isVisible ?? true,
  }), [createEntryClientKey]);

  const serializeEntrySnapshot = (entry) => JSON.stringify({
    diagnosis: String(entry?.diagnosis || ''),
    evolution: normalizeClinicalRichTextHtml(entry?.evolution || ''),
    date: String(entry?.date || ''),
    attachments: ensureArray(entry?.attachments),
  });

  const findEntryByClientKey = (clientKey) => (
    historyEntriesRef.current.find((entry) => entry.clientKey === clientKey) || null
  );

  const clearEntryTimer = (clientKey) => {
    if (timers.current[clientKey]) {
      window.clearTimeout(timers.current[clientKey]);
      delete timers.current[clientKey];
    }
  };

  const updateEntryByClientKey = (clientKey, updater) => {
    setHistoryEntries((prev) => prev.map((entry) => (
      entry.clientKey === clientKey
        ? normalizeEntryState(updater(entry), clientKey)
        : entry
    )));
  };

  // --- 2. CARGA DE DATOS ---
  useEffect(() => {
    if (!activePatientId) {
      navigate(APP_ROUTES.clinicalHistories, { replace: true });
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [pRes, hRes, cyclesRes] = await Promise.all([
          api.get(`/patients/${activePatientId}`),
          api.get(`/clinical-history/${activePatientId}`),
          // Sin ciclos la historia igual se ve; solo faltan los avisos.
          api.get(`/patients/${activePatientId}/session-cycles`).catch(() => ({ data: null })),
        ]);

        setPatient(pRes.data);
        const loadedCycles = Array.isArray(cyclesRes.data?.cycles) ? cyclesRes.data.cycles : [];
        setSessionCycles(loadedCycles);
        persistClinicalHistoryContext({
          patientId: pRes.data.id || activePatientId,
          patientName: pRes.data.fullName || '',
        });

        const formattedEntries = (Array.isArray(hRes.data) ? hRes.data : []).map((entry) => (
          normalizeEntryState(entry, String(entry.id))
        ));

        // Fichas de ingreso cargadas con otra fecha: pasan solas a la fecha del turno.
        const fixes = new Map(findAutoFixableEntries(loadedCycles, formattedEntries).map((fix) => [fix.clientKey, fix]));
        const fixedEntries = formattedEntries.map((entry) => {
          const fix = fixes.get(entry.clientKey);
          if (!fix) return entry;
          return {
            ...entry,
            date: fix.dateKey,
            diagnosis: entry.diagnosis?.trim() ? entry.diagnosis : fix.diagnosis,
            status: 'typing',
          };
        });
        pendingAutoFixRef.current = [...fixes.keys()];
        if (fixes.size > 0) {
          toast.success(fixes.size === 1
            ? 'Se pasó 1 ficha a la fecha de su turno'
            : `Se pasaron ${fixes.size} fichas a la fecha de su turno`);
        }
        setHistoryEntries(fixedEntries);
      } catch {
        toast.error('Error al conectar con el servidor');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activePatientId, navigate, normalizeEntryState]);

  useEffect(() => {
    if (patient?.fullName) {
      document.title = `Agenda Kareh | ${patient.fullName}`;
    }
  }, [patient]);

  // --- 3. LÓGICA DE PERSISTENCIA ---

  const handleUpdatePatient = async (field, value) => {
    try {
      // Usamos PATCH si el servidor lo permite, si no, usa PUT enviando todo el objeto
      await api.patch(`/patients/${activePatientId}`, { [field]: value });
      setPatient(prev => ({ ...prev, [field]: value }));
      toast.success("Ficha actualizada");
    } catch {
      toast.error("Error al actualizar la ficha");
    }
  };

  const saveEntry = async (entryInput) => {
    const entry = normalizeEntryState(entryInput, entryInput?.clientKey);
    const entryClientKey = entry.clientKey;

    if (isClinicalRichTextEmpty(entry.evolution) && !entry.diagnosis?.trim() && String(entry.id).startsWith('temp-')) {
      return;
    }

    if (inFlightSaveClientKeysRef.current.has(entryClientKey)) {
      pendingResaveClientKeysRef.current.add(entryClientKey);
      return;
    }

    const requestSnapshot = serializeEntrySnapshot(entry);
    inFlightSaveClientKeysRef.current.add(entryClientKey);
    setHistoryEntries((prev) => prev.map((currentEntry) => (
      currentEntry.clientKey === entryClientKey
        ? { ...currentEntry, status: 'saving' }
        : currentEntry
    )));

    try {
      const payload = {
        patientId: activePatientId,
        diagnosis: entry.diagnosis || '',
        evolution: normalizeClinicalRichTextHtml(entry.evolution || ''),
        createdAt: entry.date,
        attachments: JSON.stringify(entry.attachments),
        // Solo al crear: queda firmada por el profesional del ciclo.
        ...(String(entry.id).startsWith('temp-') && entry.professionalId && { professionalId: entry.professionalId }),
      };

      const response = String(entry.id).startsWith('temp-')
        ? await api.post('/clinical-history', payload)
        : await api.put(`/clinical-history/${entry.id}`, payload);

      const savedData = normalizeEntryState({
        ...response.data,
        clientKey: entryClientKey,
        status: 'saved',
        isVisible: entry.isVisible,
      }, entryClientKey);

      setHistoryEntries((prev) => prev.map((currentEntry) => {
        if (currentEntry.clientKey !== entryClientKey) return currentEntry;

        if (serializeEntrySnapshot(currentEntry) !== requestSnapshot) {
          return {
            ...currentEntry,
            id: String(currentEntry.id).startsWith('temp-') ? savedData.id : currentEntry.id,
            status: 'typing',
          };
        }

        return {
          ...currentEntry,
          ...savedData,
          status: 'saved',
        };
      }));
    } catch {
      setHistoryEntries((prev) => prev.map((currentEntry) => (
        currentEntry.clientKey === entryClientKey
          ? { ...currentEntry, status: 'error' }
          : currentEntry
      )));
    } finally {
      inFlightSaveClientKeysRef.current.delete(entryClientKey);

      if (pendingResaveClientKeysRef.current.has(entryClientKey)) {
        pendingResaveClientKeysRef.current.delete(entryClientKey);
        window.setTimeout(() => {
          const currentEntry = findEntryByClientKey(entryClientKey);
          if (!currentEntry) return;
          void saveEntry(currentEntry);
        }, 0);
      }
    }
  };

  const queueSaveEntry = (clientKey, delayMs = 0) => {
    clearEntryTimer(clientKey);

    const runSave = () => {
      delete timers.current[clientKey];
      const currentEntry = findEntryByClientKey(clientKey);
      if (!currentEntry) return;
      void saveEntry(currentEntry);
    };

    timers.current[clientKey] = window.setTimeout(runSave, Math.max(0, delayMs));
  };

  const uploadAttachment = async (file, entryId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (activePatientId) formData.append('patientId', activePatientId);
    if (entryId && !entryId.toString().startsWith('temp-')) formData.append('entryId', entryId);
    const response = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  };

  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('No se pudo procesar la imagen'));
          const name = file.name?.toLowerCase().endsWith('.jpg') || file.name?.toLowerCase().endsWith('.jpeg')
            ? file.name
            : 'foto.jpg';
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.6);
      };
      img.onerror = () => reject(new Error('Imagen inválida'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });

  const handleFileUpload = async (clientKey, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`Archivo demasiado grande. Máximo ${MAX_UPLOAD_MB}MB.`);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    const isImage = file.type?.startsWith('image/');

    toast.loading(isPdf ? 'Subiendo PDF...' : (isImage ? 'Procesando imagen...' : 'Subiendo archivo...'), { id: 'uploading' });
    try {
      const currentEntry = findEntryByClientKey(clientKey);
      if (!currentEntry) {
        toast.error('La sesión ya no está disponible.', { id: 'uploading' });
        return;
      }

      const fileToUpload = isImage ? await compressImage(file) : file;
      const attachment = await uploadAttachment(fileToUpload, currentEntry.id);

      const freshEntry = findEntryByClientKey(clientKey);
      if (freshEntry) {
        const entryToSave = {
          ...freshEntry,
          attachments: [...(freshEntry.attachments || []), attachment],
          status: 'typing',
        };
        updateEntryByClientKey(clientKey, () => entryToSave);
        void saveEntry(entryToSave);
      }
      toast.success('Archivo guardado', { id: 'uploading' });
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.detail || 'No se pudo subir el archivo.';
      toast.error(message, { id: 'uploading' });
    } finally {
      e.target.value = '';
    }
  };

  // Ficha nueva con la fecha del turno de ingreso/reingreso (no la del día en que se carga).
  const addEntry = (dateKey) => {
    const clientKey = `temp-${Date.now()}`;
    const cycleProfessional = findCycleForDate(sessionCycles, dateKey)?.professional || null;
    setHistoryEntries((prev) => [
      normalizeEntryState({
        id: clientKey,
        clientKey,
        date: dateKey,
        diagnosis: findDiagnosisForDate(sessionCycles, dateKey),
        evolution: NEW_ENTRY_TEMPLATE,
        attachments: [],
        professionalId: cycleProfessional?.id || null,
        professional: cycleProfessional,
        status: 'typing',
        isVisible: true,
      }, clientKey),
      ...prev,
    ]);
  };

  // Guarda las fichas que se pasaron solas a la fecha del turno al cargar.
  useEffect(() => {
    if (pendingAutoFixRef.current.length === 0) return;
    const clientKeys = pendingAutoFixRef.current;
    pendingAutoFixRef.current = [];
    clientKeys.forEach((clientKey) => queueSaveEntry(clientKey, 0));
  });

  // Corrige una ficha vieja: fecha del turno y, si no tenía, su diagnóstico.
  const applyAppointmentToEntry = (clientKey, appointmentData) => {
    const freshEntry = findEntryByClientKey(clientKey);
    if (!freshEntry || !appointmentData) return;
    const entryToSave = {
      ...freshEntry,
      date: appointmentData.dateKey,
      diagnosis: freshEntry.diagnosis?.trim() ? freshEntry.diagnosis : appointmentData.diagnosis,
      status: 'typing',
    };
    updateEntryByClientKey(clientKey, () => entryToSave);
    void saveEntry(entryToSave);
  };

  // --- 4. RENDER ---
  const todayKey = todayDateKey();
  const missingIntakes = findMissingIntakes(sessionCycles, historyEntries, todayKey);
  const abandonMessages = buildAbandonMessagesByEntry(sessionCycles, historyEntries);
  const getEntrySignature = (entry) => buildProfessionalSignature(resolveEntryProfessional(entry, sessionCycles));
  const filteredEntries = historyEntries.filter(e => e.date.includes(dateSearch));
  const printableEntries = filteredEntries.filter(entry => entry.isVisible !== false);
  const coverageLabel = getCoverageLabel(patient?.healthInsurance, patient?.treatAsParticular);
  const insuranceDocumentHistory = patient?.documentHistory || [];
  const coverageTextClass = isParticularCoverage(patient?.healthInsurance, patient?.treatAsParticular)
    ? 'text-blue-700'
    : 'text-teal-600';

  const formatDisplayDate = (value) => {
    if (!value || isUnknownBirthDate(value)) return 'Sin dato';
    const normalized = value.includes('T') ? value : `${value}T12:00:00`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-AR');
  };

  const handlePrintClinicalHistory = () => {
    const printWindow = window.open('', '', 'height=900,width=1200');
    if (!printWindow) {
      toast.error('El navegador bloqueó la ventana de impresión.');
      return;
    }

    const patientSummary = {
      fullName: escapePrintHtml(patient?.fullName || 'Paciente sin nombre'),
      recordNumber: escapePrintHtml(formatClinicalRecordNumber(patient?.clinicalRecordNumber)),
      dni: escapePrintHtml(patient?.dni || 'Sin dato'),
      birthDate: escapePrintHtml(formatDisplayDate(patient?.birthDate || '')),
      age: escapePrintHtml(String(calculateAge(patient?.birthDate))),
      coverage: escapePrintHtml(coverageLabel || 'Sin cobertura'),
      coverageClass: isParticularCoverage(patient?.healthInsurance, patient?.treatAsParticular)
        ? 'coverage-blue'
        : 'coverage-teal',
      affiliateNumber: escapePrintHtml(patient?.affiliateNumber || 'Sin número'),
      folio: escapePrintHtml(patient?.actaBookFolio || 'Sin asignar'),
      phone: escapePrintHtml(patient?.phone || 'Sin dato'),
      address: escapePrintHtml(patient?.address || 'Sin dato'),
      risks: [
        { label: 'Cáncer', active: !!patient?.hasCancer },
        { label: 'Marcapasos', active: !!patient?.hasMarcapasos },
      ],
    };

    const printablePayload = printableEntries.map((entry) => ({
      abandonMessage: escapePrintHtml(abandonMessages.get(entry.clientKey) || ''),
      signatureName: escapePrintHtml(getEntrySignature(entry)?.name || ''),
      signatureLicenses: escapePrintHtml(getEntrySignature(entry)?.licenses || ''),
      dateLabel: escapePrintHtml(formatDisplayDate(entry.date)),
      diagnosis: escapePrintHtml(entry.diagnosis || 'Sin diagnóstico'),
      evolutionHtml: isClinicalRichTextEmpty(entry.evolution)
        ? 'Sin evolución registrada.'
        : normalizeClinicalRichTextHtml(entry.evolution),
    }));

    printWindow.document.write(buildClinicalHistoryPrintHtml({
      patientSummary,
      entries: printablePayload,
    }));
    printWindow.document.close();
  };

  if (loading) return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <Loader className="animate-spin text-teal-600 w-12 h-12" />
    </div>
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen pb-20">
        <div className="mx-auto min-h-screen max-w-6xl bg-white p-3 shadow-2xl sm:p-6">
          <style>{`
          .print-layout { display: none; }

          @media print { 
            @page {
              size: A4;
              margin: 14mm;
            }

            html, body {
              background: #f4f5f7 !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            nav, aside, .screen-layout, .no-print, .is-hidden {
              display: none !important;
            }

            .print-layout {
              display: block !important;
            }

            .max-w-6xl {
              max-width: 100% !important;
              margin: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
              background: #f4f5f7 !important;
              min-height: auto !important;
              overflow: visible !important;
            }

            .print-shell {
              background: #f4f5f7 !important;
              color: #1e293b !important;
              overflow: visible !important;
            }

            .print-header,
            .print-sidebar-card,
            .print-session-card {
              break-inside: avoid;
              box-shadow: none !important;
            }

            .overflow-y-auto,
            .custom-scrollbar,
            .flex-1,
            .min-h-screen {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
            }

            *::-webkit-scrollbar {
              display: none !important;
            }
          }
        `}</style>

          <div className="screen-layout">
            <button onClick={() => navigate(APP_ROUTES.clinicalHistories)} className="no-print flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] mb-6">
              <ChevronLeft size={16} /> Volver al listado
            </button>

            <header className="mb-8 flex flex-col gap-4 border-b border-slate-100 pb-6 md:mb-10 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h1 className="text-[11px] font-black text-teal-600 uppercase tracking-[0.3em] mb-2">KAREH · Historia Clínica</h1>
                <p className="mb-3 inline-flex rounded-full bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  {formatClinicalRecordNumber(patient?.clinicalRecordNumber)}
                </p>
                <h2 className="text-4xl md:text-5xl font-black text-slate-800 uppercase italic tracking-tighter">
                  {patient?.fullName}
                </h2>
              </div>
              <div className="no-print flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <button
                  type="button"
                  onClick={() => setOpenDocument('report')}
                  disabled={!patient}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-3 text-[10px] font-black text-teal-800 hover:bg-teal-100 disabled:opacity-50"
                >
                  <FileText size={16} /> INFORME KINÉSICO
                </button>
                <button
                  type="button"
                  onClick={() => setOpenDocument('receipt')}
                  disabled={!patient}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Receipt size={16} /> COMPROBANTE
                </button>
                <button onClick={handlePrintClinicalHistory} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-[10px] font-black text-white shadow-lg hover:bg-slate-800">
                  <Printer size={16} /> IMPRIMIR SESIONES
                </button>
              </div>
              {patient && openDocument === 'report' && (
                <KinesicReportModal
                  key={patient.id}
                  patient={patient}
                  onClose={() => setOpenDocument(null)}
                  onSaved={() => setReportsRefreshKey((value) => value + 1)}
                />
              )}
              {patient && editingReport && (
                <KinesicReportModal
                  key={editingReport.id}
                  patient={patient}
                  report={editingReport}
                  onClose={() => setEditingReport(null)}
                  onSaved={() => setReportsRefreshKey((value) => value + 1)}
                />
              )}
              {patient && openDocument === 'receipt' && (
                <PatientReceiptModal
                  key={patient.id}
                  patient={patient}
                  onClose={() => setOpenDocument(null)}
                  onCreated={() => setReceiptsRefreshKey((value) => value + 1)}
                />
              )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-1 space-y-6 no-print">
                <section className="bg-slate-50 p-6 rounded-4xl border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Ficha Base</h3>
                  <div className="space-y-3 text-[11px]">
                    <p className="flex justify-between border-b border-slate-200 pb-2"><b>HC:</b> <span>{formatClinicalRecordNumber(patient?.clinicalRecordNumber)}</span></p>
                    <p className="flex justify-between border-b border-slate-200 pb-2"><b>DNI:</b> <span>{patient?.dni}</span></p>

                    <div className="border-b border-slate-200 pb-2">
                      <p className="text-[9px] text-slate-400 font-black mb-1 uppercase">Fecha Nacimiento:</p>
                      <input
                        type="date"
                        value={patient?.birthDate && !isUnknownBirthDate(patient.birthDate) ? patient.birthDate.split('T')[0] : ''}
                        onChange={(e) => handleUpdatePatient('birthDate', e.target.value)}
                        className="w-full bg-transparent font-bold text-slate-700 outline-none focus:text-teal-600"
                      />
                    </div>

                    <p className="flex justify-between border-b border-slate-200 pb-2">
                      <b>EDAD:</b>
                      <span className="bg-teal-100 px-2 rounded-lg font-black text-teal-700">
                        {calculateAge(patient?.birthDate)}
                      </span>
                    </p>
                    <p className="flex justify-between border-b border-slate-200 pb-2"><b>OS:</b> <span className={`${coverageTextClass} font-black uppercase`}>{coverageLabel}</span></p>
                    <button
                      type="button"
                      onClick={() => handleUpdatePatient('treatAsParticular', !patient?.treatAsParticular)}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${patient?.treatAsParticular
                          ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                      <span>Tratamiento particular</span>
                      <span>{patient?.treatAsParticular ? 'Activo' : 'Desactivado'}</span>
                    </button>
                    <div className="border-t border-slate-200 pt-2">
                      <p className="text-[9px] text-slate-400 font-black mb-1 uppercase">N° Afiliado:</p>
                      <input
                        type="text"
                        value={patient?.affiliateNumber || ''}
                        onChange={(e) => handleUpdatePatient('affiliateNumber', e.target.value)}
                        className="w-full bg-transparent font-bold text-slate-700 outline-none focus:text-teal-600"
                        placeholder="Sin número"
                      />
                    </div>
                  </div>
                </section>

                <section className="bg-amber-50/50 p-6 rounded-4xl border border-amber-100 shadow-sm">
                  <h3 className="text-[10px] font-black text-amber-600 uppercase mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Riesgos</h3>
                  <div className="space-y-2">
                    {[{ id: 'hasCancer', l: 'Cáncer' }, { id: 'hasMarcapasos', l: 'Marcapasos' }, { id: 'usesEA', l: 'Usa EA' }].map(item => (
                      <label key={item.id} className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-sm text-[10px] font-bold uppercase cursor-pointer hover:bg-amber-50 transition-all">
                        {item.l}
                        <input
                          type="checkbox"
                          checked={!!patient?.[item.id]}
                          onChange={(e) => handleUpdatePatient(item.id, e.target.checked)}
                          className="w-4 h-4 accent-teal-600"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="bg-teal-50/50 p-6 rounded-4xl border border-teal-100 shadow-sm">
                  <h3 className="text-[10px] font-black text-teal-600 uppercase mb-4 tracking-widest">Documentación presentada</h3>
                  {insuranceDocumentHistory.length === 0 ? (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      No hay documentación registrada desde turnos previos.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insuranceDocumentHistory.map((document, index) => (
                        <a
                          key={`${document.appointmentId}-${document.name}-${index}`}
                          href={getAuthenticatedFileUrl(document.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-3xl border border-white/80 bg-white px-4 py-4 shadow-sm transition hover:border-teal-200"
                        >
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">
                            {document.name}
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-700">
                            {document.obraSocialName || 'Sin obra social'}
                          </p>
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Presentado: {formatDisplayDate(document.presentedAt || document.appointmentDate)}
                          </p>
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                {patient?.id && (
                  <PatientReportsSection
                    patientId={patient.id}
                    refreshKey={reportsRefreshKey}
                    onEdit={setEditingReport}
                  />
                )}
                {patient?.id && <PatientReceiptsSection patientId={patient.id} refreshKey={receiptsRefreshKey} />}
              </div>

              <div className="md:col-span-3 space-y-6">
                <div className="no-print flex flex-col gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:w-64">
                    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por fecha..."
                      className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-teal-400 transition-all"
                      value={dateSearch}
                      onChange={(e) => setDateSearch(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => addEntry(pickNewEntryDate(sessionCycles, historyEntries, todayKey))}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-[10px] font-black text-white shadow-lg hover:bg-teal-700 md:w-auto"
                  >
                    <PlusCircle size={16} /> NUEVA EVOLUCIÓN
                  </button>
                </div>

                {missingIntakes.length > 0 && (
                  <section role="alert" className="no-print rounded-3xl border-2 border-amber-300 bg-amber-50 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-amber-800">
                      <AlertTriangle size={16} />
                      {missingIntakes.length === 1
                        ? 'Falta pasar 1 ficha de ingreso / reingreso'
                        : `Faltan pasar ${missingIntakes.length} fichas de ingreso / reingreso`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {missingIntakes.map((intake) => (
                        <button
                          key={intake.cycleNumber}
                          type="button"
                          onClick={() => addEntry(intake.dateKey)}
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 py-2 text-[10px] font-black uppercase text-amber-800 transition hover:bg-amber-100"
                        >
                          <PlusCircle size={14} /> {intake.label} del {formatDateKey(intake.dateKey)}
                          {intake.isUpcoming && <span className="font-bold normal-case text-amber-600">(próximo turno)</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {filteredEntries.map((entry) => (
                  <div key={entry.clientKey} className={`session-card border-2 transition-all rounded-3xl bg-slate-50 overflow-hidden ${!entry.isVisible ? 'opacity-40 grayscale is-hidden' : 'border-slate-100 shadow-sm'}`}>
                    <div className="flex flex-col gap-3 border-b bg-slate-50 px-4 py-4 sm:px-8 md:flex-row md:items-center md:justify-between">
                      <input
                        type="date"
                        className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-black text-teal-700 text-[11px] outline-none"
                        value={entry.date}
                        onChange={(e) => {
                          const freshEntry = findEntryByClientKey(entry.clientKey);
                          if (freshEntry) {
                            const entryToSave = {
                              ...freshEntry,
                              date: e.target.value,
                              status: 'typing',
                            };
                            updateEntryByClientKey(entry.clientKey, () => entryToSave);
                            void saveEntry(entryToSave);
                          }
                        }}
                      />
                      {describeEntryAppointment(sessionCycles, entry.date) && (
                        <span className="inline-flex w-fit rounded-xl bg-teal-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-teal-700">
                          Turno: {describeEntryAppointment(sessionCycles, entry.date).label}
                        </span>
                      )}
                      <div className="flex items-center gap-3 no-print">
                        <button onClick={() => setHistoryEntries((prev) => prev.map((currentEntry) => (
                          currentEntry.clientKey === entry.clientKey
                            ? { ...currentEntry, isVisible: !currentEntry.isVisible }
                            : currentEntry
                        )))} className={`p-2 rounded-xl border ${entry.isVisible ? 'bg-white text-slate-400' : 'bg-amber-100 text-amber-600'}`}>
                          {entry.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          onClick={() => {
                            openModal({
                              title: 'Eliminar sesión',
                              message: 'Se quitará esta evolución de la historia clínica. ¿Deseas continuar?',
                              confirmText: 'Eliminar',
                              danger: true,
                              icon: Trash2,
                              onConfirm: async () => {
                                clearEntryTimer(entry.clientKey);
                                if (!String(entry.id).startsWith('temp-')) {
                                  await api.delete(`/clinical-history/${entry.id}`);
                                }
                                setHistoryEntries((prev) => prev.filter((currentEntry) => currentEntry.clientKey !== entry.clientKey));
                                toast.success("Eliminado");
                              },
                            });
                          }}
                          className="p-2 bg-white text-red-400 border border-slate-200 rounded-xl hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="text-[9px] font-black uppercase ml-2">
                          {entry.status === 'saved' && <span className="text-teal-500">●</span>}
                          {entry.status === 'saving' && <span className="text-amber-500 animate-pulse">●</span>}
                        </div>
                      </div>
                    </div>

                    {findEntryDateMismatch(sessionCycles, entry) && (
                      <div role="alert" className="no-print flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                        <p className="text-[11px] font-black text-amber-800">
                          La fecha de esta ficha no coincide con ningún turno. {findEntryDateMismatch(sessionCycles, entry).label}: {formatDateKey(findEntryDateMismatch(sessionCycles, entry).dateKey)}
                        </p>
                        <button
                          type="button"
                          onClick={() => applyAppointmentToEntry(entry.clientKey, findEntryDateMismatch(sessionCycles, entry))}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-amber-600"
                        >
                          Usar fecha y diagnóstico del turno
                        </button>
                      </div>
                    )}

                    <div className="space-y-4 p-4 sm:p-8">
                      <input
                        className="w-full text-xl font-black text-slate-800 uppercase outline-none placeholder:text-slate-200"
                        placeholder="Diagnóstico..."
                        value={entry.diagnosis}
                        onChange={(e) => {
                          updateEntryByClientKey(entry.clientKey, (currentEntry) => ({
                            ...currentEntry,
                            diagnosis: e.target.value,
                            status: 'typing',
                          }));
                          queueSaveEntry(entry.clientKey, 2000);
                        }}
                      />
                      <RichTextEditor
                        value={entry.evolution}
                        placeholder="Evolución..."
                        onChange={(nextHtml) => {
                          updateEntryByClientKey(entry.clientKey, (currentEntry) => ({
                            ...currentEntry,
                            evolution: nextHtml,
                            status: 'typing',
                          }));
                          queueSaveEntry(entry.clientKey, 2000);
                        }}
                      />

                      {abandonMessages.has(entry.clientKey) && (
                        <p className="rounded-2xl border-2 border-amber-400 bg-yellow-300 px-4 py-3 text-sm font-black uppercase text-amber-950">
                          {abandonMessages.get(entry.clientKey)}
                        </p>
                      )}

                      {entry.attachments?.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                          {entry.attachments.map((file, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-black">
                              {isImageAttachment(file) ? (
                                <img src={getAttachmentUrl(file)} alt="Adjunto" className="w-full h-full object-cover opacity-90 hover:opacity-100" />
                              ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900 text-slate-100 px-3 text-center">
                                  <FileText size={24} />
                                  <span className="text-[10px] font-black uppercase tracking-widest">
                                    {isPdfAttachment(file) ? 'PDF' : 'ARCHIVO'}
                                  </span>
                                  <span className="text-[9px] text-slate-300 truncate w-full">
                                    {getAttachmentLabel(file)}
                                  </span>
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                <button onClick={() => openAttachment(file)} className="bg-white p-2 rounded-full text-slate-800"><Maximize2 size={16} /></button>
                              </div>
                              <button
                                onClick={() => {
                                  const freshEntry = findEntryByClientKey(entry.clientKey);
                                  if (freshEntry) {
                                    const entryToSave = {
                                      ...freshEntry,
                                      attachments: freshEntry.attachments.filter((_, fileIndex) => fileIndex !== idx),
                                      status: 'typing',
                                    };
                                    updateEntryByClientKey(entry.clientKey, () => entryToSave);
                                    void saveEntry(entryToSave);
                                  }
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg no-print"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <ProfessionalSignature signature={getEntrySignature(entry)} />

                      <div className="no-print flex flex-wrap gap-2 border-t border-slate-50 pt-4">
                        <label className="flex items-center gap-2 text-teal-600 text-[9px] font-black cursor-pointer bg-teal-50 px-4 py-2 rounded-xl border border-teal-100 hover:bg-teal-100">
                          <Camera size={14} /> CAPTURAR
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(entry.clientKey, e)} />
                        </label>
                        <label className="flex items-center gap-2 text-slate-500 text-[9px] font-black cursor-pointer bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100">
                          <Upload size={14} /> ADJUNTAR
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(entry.clientKey, e)} />
                        </label>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          Max {MAX_UPLOAD_MB}MB
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="print-layout print-shell">
            <header className="print-header mb-8 border-b border-slate-300 pb-6">
              <div className="mb-3 text-[11px] font-black uppercase tracking-[0.35em] text-teal-600">Kareh · Historia Clínica</div>
              <div className="mb-3 inline-flex rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                {formatClinicalRecordNumber(patient?.clinicalRecordNumber)}
              </div>
              <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-800">{patient?.fullName}</h1>
            </header>

            <div className="grid grid-cols-[220px_1fr] gap-8 items-start">
              <div className="space-y-6">
                <section className="print-sidebar-card rounded-4xl border border-slate-300 bg-slate-100 p-6">
                  <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Ficha Base</h3>
                  <div className="space-y-4 text-[12px]">
                    <div className="border-b border-slate-300 pb-3">
                      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Historia Clínica</div>
                      <div className="font-black text-slate-800">{formatClinicalRecordNumber(patient?.clinicalRecordNumber)}</div>
                    </div>
                    <div className="border-b border-slate-300 pb-3">
                      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">DNI</div>
                      <div className="font-black text-slate-800">{patient?.dni || 'Sin dato'}</div>
                    </div>
                    <div className="border-b border-slate-300 pb-3">
                      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Fecha Nacimiento</div>
                      <div className="font-black text-slate-800">{formatDisplayDate(patient?.birthDate || '')}</div>
                    </div>
                    <div className="border-b border-slate-300 pb-3">
                      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Edad</div>
                      <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 font-black text-teal-700">{calculateAge(patient?.birthDate)}</div>
                    </div>
                    <div className="border-b border-slate-300 pb-3">
                      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">OS</div>
                      <div className={`font-black uppercase ${coverageTextClass}`}>{coverageLabel}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">N° Afiliado</div>
                      <div className="font-black text-slate-500">{patient?.affiliateNumber || 'Sin número'}</div>
                    </div>
                  </div>
                </section>

                <section className="print-sidebar-card rounded-4xl border border-amber-200 bg-amber-50/60 p-6">
                  <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Riesgos</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Cáncer', active: !!patient?.hasCancer },
                      { label: 'Marcapasos', active: !!patient?.hasMarcapasos },
                      { label: 'Usa EA', active: !!patient?.usesEA },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase text-slate-800">
                        <span>{item.label}</span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] ${item.active ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                          ✓
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                {printableEntries.map((entry) => (
                  <article key={entry.id} className="print-session-card overflow-hidden rounded-4xl border-2 border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-8 py-5">
                      <div className="rounded-2xl border border-slate-300 bg-white px-5 py-2 text-[12px] font-black text-teal-700">
                        {formatDisplayDate(entry.date)}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-400">
                        {entry.status === 'saved' && <span className="text-teal-500">●</span>}
                      </div>
                    </div>

                    <div className="space-y-6 p-8">
                      <h2 className="text-3xl font-black uppercase tracking-tight text-slate-800">
                        {entry.diagnosis || 'Sin diagnóstico'}
                      </h2>
                      <div className="min-h-[180px] rounded-4xl bg-white text-[15px] leading-relaxed text-slate-700">
                        {isClinicalRichTextEmpty(entry.evolution) ? (
                          'Sin evolución registrada.'
                        ) : (
                          <div
                            className="space-y-3 wrap-break-word [&_li]:mb-2 [&_mark]:rounded-sm [&_mark]:px-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_span]:wrap-break-word [&_strong]:font-black [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6"
                            dangerouslySetInnerHTML={{ __html: normalizeClinicalRichTextHtml(entry.evolution) }}
                          />
                        )}
                      </div>

                      {abandonMessages.has(entry.clientKey) && (
                        <p className="rounded-2xl border-2 border-amber-400 bg-yellow-300 px-4 py-3 text-sm font-black uppercase text-amber-950">
                          {abandonMessages.get(entry.clientKey)}
                        </p>
                      )}

                      {entry.attachments?.length > 0 && (
                        <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                          {entry.attachments.map((file, idx) => (
                            <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                              {isImageAttachment(file) ? (
                                <img src={getAttachmentUrl(file)} alt="Adjunto clínico" className="h-36 w-full object-cover" />
                              ) : (
                                <div className="flex h-36 w-full items-center justify-center gap-2 text-[10px] font-black uppercase text-slate-500">
                                  <FileText size={16} />
                                  {isPdfAttachment(file) ? 'PDF' : 'ARCHIVO'}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <ProfessionalSignature signature={getEntrySignature(entry)} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {ConfirmModalComponent}
    </>
  );
};

export default ClinicalHistoryPage;
