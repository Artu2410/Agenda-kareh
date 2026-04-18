import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Save, FileText, Eye, EyeOff, Trash2, AlertTriangle, PlusCircle, 
  Loader, X, Upload, Camera, Printer, Calendar, CheckCircle2, ChevronLeft, Search, Maximize2
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useConfirmModal } from '../hooks/useConfirmModal';
import {
  APP_ROUTES,
  persistClinicalHistoryContext,
  readClinicalHistoryContext,
} from '../utils/appRoutes';
import { getCoverageLabel, isParticularCoverage } from '../utils/coverage';
import RichTextEditor from '../components/clinical/RichTextEditor';
import {
  isClinicalRichTextEmpty,
  normalizeClinicalRichTextHtml,
} from '../utils/clinicalRichText';

const formatClinicalRecordNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) return 'Pendiente';
  return `HC ${String(numericValue).padStart(4, '0')}`;
};

const escapePrintHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildClinicalHistoryPrintHtml = ({ patientSummary, entries }) => {
  const entryMarkup = entries.length > 0
    ? entries.map((entry) => {
      const attachmentsMarkup = entry.attachments.length > 0
        ? `
          <div class="attachments-grid">
            ${entry.attachments.map((attachment) => (
              attachment.kind === 'image'
                ? `
                  <figure class="attachment-card image-card">
                    <img src="${attachment.url}" alt="${attachment.label}" />
                    <figcaption>${attachment.label}</figcaption>
                  </figure>
                `
                : `
                  <div class="attachment-card file-card">
                    <div class="file-badge">${attachment.fileType}</div>
                    <div class="file-label">${attachment.label}</div>
                  </div>
                `
            )).join('')}
          </div>
        `
        : '';

      return `
        <article class="session-card">
          <div class="session-card__header">
            <span class="session-date">${entry.dateLabel}</span>
          </div>
          <div class="session-card__body">
            <h2>${entry.diagnosis}</h2>
            <div class="evolution-block">${entry.evolutionHtml}</div>
            ${attachmentsMarkup}
          </div>
        </article>
      `;
    }).join('')
    : `
      <article class="session-card">
        <div class="session-card__body">
          <h2>Sin evoluciones visibles</h2>
          <div class="evolution-block">
            No hay registros visibles para imprimir en este momento.
          </div>
        </div>
      </article>
    `;

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Historia clínica - ${patientSummary.fullName}</title>
        <style>
          @page {
            size: A4;
            margin: 14mm;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #f4f5f7;
            color: #1e293b;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            padding: 18px;
          }

          .print-shell {
            max-width: 1120px;
            margin: 0 auto;
          }

          .print-header {
            margin-bottom: 28px;
            padding-bottom: 20px;
            border-bottom: 1px solid #cbd5e1;
          }

          .eyebrow {
            margin-bottom: 10px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.35em;
            text-transform: uppercase;
            color: #0d9488;
          }

          .record-badge {
            display: inline-flex;
            margin-bottom: 14px;
            padding: 8px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            background: #f1f5f9;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: #64748b;
          }

          .patient-title {
            margin: 0;
            font-size: 42px;
            font-weight: 900;
            font-style: italic;
            letter-spacing: -0.04em;
            text-transform: uppercase;
            color: #0f172a;
          }

          .layout {
            display: grid;
            grid-template-columns: 220px minmax(0, 1fr);
            gap: 28px;
            align-items: start;
          }

          .sidebar {
            display: grid;
            gap: 20px;
          }

          .sidebar-card,
          .session-card {
            break-inside: avoid;
            box-shadow: none;
            overflow: hidden;
            border-radius: 28px;
            background: #ffffff;
          }

          .sidebar-card {
            border: 1px solid #cbd5e1;
            padding: 24px;
          }

          .sidebar-card.risk-card {
            border-color: #fcd34d;
            background: rgba(254, 243, 199, 0.55);
          }

          .sidebar-title {
            margin: 0 0 16px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: #94a3b8;
          }

          .field {
            padding-bottom: 12px;
            margin-bottom: 12px;
            border-bottom: 1px solid #cbd5e1;
          }

          .field:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: 0;
          }

          .field-label {
            margin-bottom: 4px;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #94a3b8;
          }

          .field-value {
            font-size: 13px;
            font-weight: 900;
            color: #1e293b;
            word-break: break-word;
          }

          .age-badge {
            display: inline-flex;
            padding: 4px 10px;
            border-radius: 999px;
            background: #ccfbf1;
            color: #0f766e;
          }

          .coverage-teal {
            color: #0f766e;
          }

          .coverage-blue {
            color: #1d4ed8;
          }

          .risk-list {
            display: grid;
            gap: 12px;
          }

          .risk-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            background: #ffffff;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            color: #1e293b;
          }

          .risk-check {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            background: #ffffff;
            color: transparent;
            font-size: 12px;
          }

          .risk-check.active {
            border-color: #0d9488;
            background: #0d9488;
            color: #ffffff;
          }

          .sessions {
            display: grid;
            gap: 24px;
          }

          .session-card {
            border: 2px solid #e2e8f0;
          }

          .session-card__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 28px;
            border-bottom: 1px solid #cbd5e1;
            background: #f1f5f9;
          }

          .session-date {
            display: inline-flex;
            padding: 8px 16px;
            border: 1px solid #cbd5e1;
            border-radius: 18px;
            background: #ffffff;
            font-size: 12px;
            font-weight: 900;
            color: #0f766e;
          }

          .session-card__body {
            padding: 28px;
          }

          .session-card__body h2 {
            margin: 0 0 18px;
            font-size: 30px;
            font-weight: 900;
            letter-spacing: -0.03em;
            text-transform: uppercase;
            color: #0f172a;
            word-break: break-word;
          }

          .evolution-block {
            min-height: 120px;
            font-size: 15px;
            line-height: 1.7;
            color: #334155;
            word-break: break-word;
          }

          .evolution-block ul,
          .evolution-block ol {
            margin: 14px 0;
            padding-left: 24px;
          }

          .evolution-block ul {
            list-style: disc;
          }

          .evolution-block ol {
            list-style: decimal;
          }

          .evolution-block li + li {
            margin-top: 6px;
          }

          .evolution-block mark {
            padding: 0 4px;
            border-radius: 3px;
          }

          .evolution-block strong {
            font-weight: 900;
          }

          .attachments-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
          }

          .attachment-card {
            overflow: hidden;
            border: 1px solid #cbd5e1;
            border-radius: 18px;
            background: #f8fafc;
          }

          .image-card img {
            display: block;
            width: 100%;
            height: 150px;
            object-fit: cover;
            background: #e2e8f0;
          }

          .image-card figcaption,
          .file-card {
            padding: 12px;
          }

          .image-card figcaption {
            font-size: 10px;
            font-weight: 900;
            color: #475569;
            word-break: break-word;
          }

          .file-card {
            display: flex;
            min-height: 150px;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            text-align: center;
          }

          .file-badge {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #0f172a;
          }

          .file-label {
            font-size: 10px;
            font-weight: 900;
            color: #64748b;
            word-break: break-word;
          }

          @media print {
            body {
              padding: 0;
            }

            .print-shell {
              max-width: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-shell">
          <header class="print-header">
            <div class="eyebrow">Kareh · Historia Clínica</div>
            <div class="record-badge">${patientSummary.recordNumber}</div>
            <h1 class="patient-title">${patientSummary.fullName}</h1>
          </header>

          <div class="layout">
            <aside class="sidebar">
              <section class="sidebar-card">
                <h2 class="sidebar-title">Ficha Base</h2>
                <div class="field">
                  <div class="field-label">Historia Clínica</div>
                  <div class="field-value">${patientSummary.recordNumber}</div>
                </div>
                <div class="field">
                  <div class="field-label">DNI</div>
                  <div class="field-value">${patientSummary.dni}</div>
                </div>
                <div class="field">
                  <div class="field-label">Fecha Nacimiento</div>
                  <div class="field-value">${patientSummary.birthDate}</div>
                </div>
                <div class="field">
                  <div class="field-label">Edad</div>
                  <div class="field-value"><span class="age-badge">${patientSummary.age} años</span></div>
                </div>
                <div class="field">
                  <div class="field-label">OS</div>
                  <div class="field-value ${patientSummary.coverageClass}">${patientSummary.coverage}</div>
                </div>
                <div class="field">
                  <div class="field-label">N° Afiliado</div>
                  <div class="field-value">${patientSummary.affiliateNumber}</div>
                </div>
              </section>

              <section class="sidebar-card risk-card">
                <h2 class="sidebar-title" style="color:#d97706;">Riesgos</h2>
                <div class="risk-list">
                  ${patientSummary.risks.map((risk) => `
                    <div class="risk-item">
                      <span>${risk.label}</span>
                      <span class="risk-check ${risk.active ? 'active' : ''}">✓</span>
                    </div>
                  `).join('')}
                </div>
              </section>
            </aside>

            <main class="sessions">
              ${entryMarkup}
            </main>
          </div>
        </div>

        <script>
          const imagePromises = Array.from(document.images).map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          });

          Promise.all(imagePromises).then(() => {
            setTimeout(() => {
              window.focus();
              window.print();
            }, 150);
          });

          window.onafterprint = () => {
            window.close();
          };
        </script>
      </body>
    </html>
  `;
};

const ClinicalHistoryPage = () => {
  const { legacyPatientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const [patient, setPatient] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateSearch, setDateSearch] = useState('');
  
  const timers = useRef({});
  const historyEntriesRef = useRef([]);
  const inFlightSaveClientKeysRef = useRef(new Set());
  const pendingResaveClientKeysRef = useRef(new Set());
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

  const calculateAge = (birthDate) => {
    if (!birthDate || isUnknownBirthDate(birthDate)) return '...';
    // Normalizamos la fecha eliminando la parte de la hora si existe
    const dateString = birthDate.includes('T') ? birthDate.split('T')[0] : birthDate;
    const [year, month, day] = dateString.split('-').map(Number);
    
    const birth = new Date(year, month - 1, day);
    if (isNaN(birth.getTime())) return 'N/A';

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age < 0 ? 0 : age;
  };

  const ensureArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try { return JSON.parse(data) || []; } catch { return []; }
  };

  const getAttachmentUrl = (file) => file?.url || file?.data || '';

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
      } catch (error) {
        console.error('Error abriendo archivo:', error);
      }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const createEntryClientKey = () => (
    globalThis.crypto?.randomUUID?.() || `history-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const normalizeEntryState = (entry, fallbackClientKey = null) => ({
    ...entry,
    clientKey: entry?.clientKey || fallbackClientKey || String(entry?.id || createEntryClientKey()),
    attachments: ensureArray(entry?.attachments),
    date: (entry?.date || entry?.createdAt || new Date().toISOString()).split('T')[0],
    evolution: normalizeClinicalRichTextHtml(entry?.evolution || ''),
    status: entry?.status || 'saved',
    isVisible: entry?.isVisible ?? true,
  });

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
        const [pRes, hRes] = await Promise.all([
          api.get(`/patients/${activePatientId}`),
          api.get(`/clinical-history/${activePatientId}`)
        ]);
        
        setPatient(pRes.data);
        persistClinicalHistoryContext({
          patientId: pRes.data.id || activePatientId,
          patientName: pRes.data.fullName || '',
        });
        
        const formattedEntries = (Array.isArray(hRes.data) ? hRes.data : []).map((entry) => (
          normalizeEntryState(entry, String(entry.id))
        ));
        setHistoryEntries(formattedEntries);
      } catch {
        toast.error('Error al conectar con el servidor');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activePatientId, navigate]);

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
    } catch (err) {
      console.error("Error al actualizar paciente:", err);
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
      console.error('Error subiendo archivo:', error);
      const message = error?.response?.data?.message || error?.response?.data?.detail || 'No se pudo subir el archivo.';
      toast.error(message, { id: 'uploading' });
    } finally {
      e.target.value = '';
    }
  };

  // --- 4. RENDER ---
  const filteredEntries = historyEntries.filter(e => e.date.includes(dateSearch));
  const printableEntries = filteredEntries.filter(entry => entry.isVisible !== false);
  const coverageLabel = getCoverageLabel(patient?.healthInsurance, patient?.treatAsParticular);
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
      risks: [
        { label: 'Cáncer', active: !!patient?.hasCancer },
        { label: 'Marcapasos', active: !!patient?.hasMarcapasos },
        { label: 'Usa EA', active: !!patient?.usesEA },
      ],
    };

    const printablePayload = printableEntries.map((entry) => ({
      dateLabel: escapePrintHtml(formatDisplayDate(entry.date)),
      diagnosis: escapePrintHtml(entry.diagnosis || 'Sin diagnóstico'),
      evolutionHtml: isClinicalRichTextEmpty(entry.evolution)
        ? 'Sin evolución registrada.'
        : normalizeClinicalRichTextHtml(entry.evolution),
      attachments: (entry.attachments || []).map((file) => ({
        kind: isImageAttachment(file) ? 'image' : 'file',
        url: escapePrintHtml(getAttachmentUrl(file)),
        label: escapePrintHtml(getAttachmentLabel(file)),
        fileType: isPdfAttachment(file) ? 'PDF' : 'ARCHIVO',
      })),
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
            <button onClick={handlePrintClinicalHistory} className="no-print flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-[10px] font-black text-white shadow-lg hover:bg-slate-800 md:w-auto">
              <Printer size={16} /> IMPRIMIR SESIONES
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1 space-y-6 no-print">
            <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-sm">
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
                    {calculateAge(patient?.birthDate)} años
                  </span>
                </p>
                <p className="flex justify-between border-b border-slate-200 pb-2"><b>OS:</b> <span className={`${coverageTextClass} font-black uppercase`}>{coverageLabel}</span></p>
                <button
                  type="button"
                  onClick={() => handleUpdatePatient('treatAsParticular', !patient?.treatAsParticular)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                    patient?.treatAsParticular
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

            <section className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 shadow-sm">
              <h3 className="text-[10px] font-black text-amber-600 uppercase mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Riesgos</h3>
              <div className="space-y-2">
                {[{id:'hasCancer', l:'Cáncer'}, {id:'hasMarcapasos', l:'Marcapasos'}, {id:'usesEA', l:'Usa EA'}].map(item => (
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
                  onClick={() => {
                    const clientKey = `temp-${Date.now()}`;
                    setHistoryEntries((prev) => [
                      normalizeEntryState({
                        id: clientKey,
                        clientKey,
                        date: new Date().toISOString().split('T')[0],
                        diagnosis: '',
                        evolution: '<p><strong>Anamnesis:</strong></p><p><br></p><p><strong>Estado Funcional:</strong></p><p><br></p><p><strong>Tto:</strong></p>',
                        attachments: [],
                        status: 'typing',
                        isVisible: true,
                      }, clientKey),
                      ...prev,
                    ]);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-[10px] font-black text-white shadow-lg hover:bg-teal-700 md:w-auto"
                >
                  <PlusCircle size={16} /> NUEVA EVOLUCIÓN
                </button>
              </div>

              {filteredEntries.map((entry) => (
                <div key={entry.clientKey} className={`session-card border-2 transition-all rounded-[2.5rem] bg-white overflow-hidden ${!entry.isVisible ? 'opacity-40 grayscale is-hidden' : 'border-slate-100 shadow-sm'}`}>
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

                    <div className="no-print flex flex-wrap gap-2 border-t border-slate-50 pt-4">
                      <label className="flex items-center gap-2 text-teal-600 text-[9px] font-black cursor-pointer bg-teal-50 px-4 py-2 rounded-xl border border-teal-100 hover:bg-teal-100">
                        <Camera size={14}/> CAPTURAR
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(entry.clientKey, e)} />
                      </label>
                      <label className="flex items-center gap-2 text-slate-500 text-[9px] font-black cursor-pointer bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100">
                        <Upload size={14}/> ADJUNTAR
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
              <section className="print-sidebar-card rounded-[2rem] border border-slate-300 bg-slate-100 p-6">
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
                    <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 font-black text-teal-700">{calculateAge(patient?.birthDate)} años</div>
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

              <section className="print-sidebar-card rounded-[2rem] border border-amber-200 bg-amber-50/60 p-6">
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
                <article key={entry.id} className="print-session-card overflow-hidden rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-sm">
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
                    <div className="min-h-[180px] rounded-[2rem] bg-white text-[15px] leading-relaxed text-slate-700">
                      {isClinicalRichTextEmpty(entry.evolution) ? (
                        'Sin evolución registrada.'
                      ) : (
                        <div
                          className="space-y-3 break-words [&_li]:mb-2 [&_mark]:rounded-sm [&_mark]:px-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_span]:break-words [&_strong]:font-black [&_u]:underline [&_ul]:list-disc [&_ul]:pl-6"
                          dangerouslySetInnerHTML={{ __html: normalizeClinicalRichTextHtml(entry.evolution) }}
                        />
                      )}
                    </div>

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
