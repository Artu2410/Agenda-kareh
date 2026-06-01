import { useCallback, useEffect, useMemo, useState } from 'react';
import instance from '../api/axios';
import { showErrorToast, showSuccessToast } from '../components/toastHelpers';
import {
  buildCokibaDetailsPayload,
  buildDocumentPayload,
  createEmptyManualForm,
  getCokibaDetails,
  getMonthInputValue,
} from '../utils/obrasSociales';

export { createEmptyManualForm, getMonthInputValue, shiftMonthValue } from '../utils/obrasSociales';

export const useObrasSociales = () => {
  const [obrasSociales, setObrasSociales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('active');
  const [filtroZona, setFiltroZona] = useState('');
  const [stats, setStats] = useState({ total: 0, activas: 0, sanMiguel: 0 });
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => getMonthInputValue());
  const [coinsuranceReport, setCoinsuranceReport] = useState({ month: '', totalAmount: 0, copayTotal: 0, rows: [] });
  const [reportLoading, setReportLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    total: 0,
    activas: 0,
    lastSyncAt: null,
    syncing: false,
    config: {
      configured: false,
      canSync: false,
      missingFields: [],
      placeholderFields: [],
    },
  });
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(createEmptyManualForm);
  const [creating, setCreating] = useState(false);
  const [sortField, setSortField] = useState('nombreOs');
  const [sortDir, setSortDir] = useState('asc');

  const fetchObrasSociales = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filtroEstado === 'active') {
        params.isActive = 'true';
      } else if (filtroEstado === 'inactive') {
        params.isActive = 'false';
      } else {
        params.includeInactive = '1';
      }

      if (filtroEstado === 'requires-auth') {
        params.requiresAuthorization = 'true';
      }

      if (filtroZona === 'san-miguel') params.zona = 'san-miguel';

      const [osRes, statsRes, syncStatusRes] = await Promise.all([
        instance.get('/obras-sociales', { params }),
        instance.get('/obras-sociales/stats'),
        instance.get('/obras-sociales/status'),
      ]);

      setObrasSociales(osRes.data);
      setStats(statsRes.data);
      setSyncStatus(syncStatusRes.data);
    } catch {
      showErrorToast('No se pudieron cargar las obras sociales.');
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroZona]);

  useEffect(() => {
    void fetchObrasSociales();
  }, [fetchObrasSociales]);

  const fetchCoinsuranceReport = useCallback(async () => {
    const month = selectedReportMonth || getMonthInputValue();

    try {
      setReportLoading(true);
      const { data } = await instance.get('/obras-sociales/coinsurance-report', {
        params: { month },
      });
      setCoinsuranceReport(data || { month, totalAmount: 0, copayTotal: 0, rows: [] });
    } catch {
      setCoinsuranceReport({ month, totalAmount: 0, copayTotal: 0, rows: [] });
      showErrorToast('No se pudo cargar el reporte mensual.');
    } finally {
      setReportLoading(false);
    }
  }, [selectedReportMonth]);

  useEffect(() => {
    void fetchCoinsuranceReport();
  }, [fetchCoinsuranceReport]);

  const filtered = useMemo(() => {
    let list = [...obrasSociales];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (os) => (
          String(os?.nombreOs || '').toLowerCase().includes(q)
          || String(os?.codigoCokiba || '').toLowerCase().includes(q)
        )
      );
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'coseguroValor' || sortField === 'honorarioEstimado') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [obrasSociales, search, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const startEdit = (os) => {
    const details = getCokibaDetails(os);
    const documents = Array.isArray(os?.requiredDocuments?.documents)
      ? os.requiredDocuments.documents
      : [];

    setEditingId(os.id);
    setExpandedId(os.id);
    setEditForm({
      nombreOs: os.nombreOs || '',
      coseguroValor: parseFloat(os.coseguroValor) || 0,
      coseguroTexto: details.coseguroTexto || '',
      honorarioEstimado: parseFloat(os.honorarioEstimado) || 0,
      percentageCoinsurance: parseFloat(os.percentageCoinsurance) || 0,
      fixedCopay: parseFloat(os.fixedCopay) || 0,
      plazoPago: os.plazoPago || 60,
      areaCobertura: details.areaCobertura || '',
      documentLines: documents
        .map((document) => (
          document?.validityDays
            ? `${document.name} (${document.validityDays} días)`
            : document?.name
        ))
        .filter(Boolean)
        .join('\n'),
      additionalDocumentInfo: String(os?.requiredDocuments?.additionalInfo || '').trim(),
      usefulLinks: (details.links || []).map((link) => link.href).filter(Boolean).join('\n'),
      atendibleSanMiguel: os.atendibleSanMiguel || false,
      isActive: os.isActive ?? true,
      statusManualOverride: os.statusManualOverride ?? false,
      requiresAuthorization: os.requiresAuthorization ?? false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const buildMutationPayload = (current, form, { includeCode = false } = {}) => {
    const details = buildCokibaDetailsPayload(current?.cokibaDetails || {}, form);
    const useManualStatus = current ? Boolean(form.statusManualOverride) : true;

    return {
      ...(includeCode && form.codigoCokiba ? { codigoCokiba: String(form.codigoCokiba).trim() } : {}),
      nombreOs: String(form.nombreOs || current?.nombreOs || '').trim(),
      coseguroValor: parseFloat(form.coseguroValor) || 0,
      honorarioEstimado: parseFloat(form.honorarioEstimado) || 0,
      percentageCoinsurance: parseFloat(form.percentageCoinsurance) || 0,
      fixedCopay: parseFloat(form.fixedCopay) || 0,
      plazoPago: parseInt(form.plazoPago, 10) || 60,
      ...(useManualStatus
        ? {
            estado: form.isActive ? 'Activa' : 'Inactiva',
            isActive: Boolean(form.isActive),
          }
        : {}),
      ...(!current
        ? {
            detectedStatus: form.isActive ? 'Activa' : 'Inactiva',
            detectedIsActive: Boolean(form.isActive),
          }
        : {}),
      statusManualOverride: useManualStatus,
      requiresAuthorization: Boolean(form.requiresAuthorization),
      atendibleSanMiguel: Boolean(form.atendibleSanMiguel),
      requiredDocuments: buildDocumentPayload(form.documentLines, form.additionalDocumentInfo),
      cokibaDetails: details,
      rawCategoria: current?.rawCategoria || 'Básica',
    };
  };

  const saveEdit = async (os) => {
    try {
      setSavingId(os.id);
      const payload = buildMutationPayload(os, editForm);
      await instance.put(`/obras-sociales/${os.id}`, payload);
      await fetchObrasSociales();
      setEditingId(null);
      setEditForm({});
      showSuccessToast('Obra social actualizada.');
    } catch {
      showErrorToast('No se pudo actualizar la obra social.');
    } finally {
      setSavingId(null);
    }
  };

  const createManualObraSocial = async () => {
    if (!String(createForm.nombreOs || '').trim()) {
      showErrorToast('Ingresá el nombre de la obra social.');
      return;
    }

    try {
      setCreating(true);
      const payload = buildMutationPayload(null, createForm, { includeCode: true });
      await instance.post('/obras-sociales', payload);
      await fetchObrasSociales();
      setCreateForm(createEmptyManualForm());
      setShowCreateForm(false);
      showSuccessToast('Obra social agregada a tu grilla.');
    } catch (error) {
      showErrorToast(error?.response?.data?.error || 'No se pudo crear la obra social.');
    } finally {
      setCreating(false);
    }
  };

  const removeFromGrid = async (os) => {
    const confirmed = window.confirm(`Quitar "${os.nombreOs}" de tu grilla?`);
    if (!confirmed) return;

    try {
      setDeletingId(os.id);
      await instance.delete(`/obras-sociales/${os.id}`);
      await fetchObrasSociales();
      if (expandedId === os.id) setExpandedId(null);
      if (editingId === os.id) {
        setEditingId(null);
        setEditForm({});
      }
      showSuccessToast('Obra social quitada de tu grilla.');
    } catch (error) {
      showErrorToast(error?.response?.data?.error || 'No se pudo quitar la obra social.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await instance.post('/obras-sociales/sync');
      await fetchObrasSociales();
      showSuccessToast(
        `Sincronización completada: ${response.data.total} registros, ${response.data.created} nuevas y ${response.data.updated} actualizadas.`
      );
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.friendlyMessage ||
        'No se pudo sincronizar con COKIBA.';
      showErrorToast(message);
    } finally {
      setSyncing(false);
    }
  };

  const currentMonthValue = getMonthInputValue();
  const canMoveReportForward = selectedReportMonth < currentMonthValue;
  const missingCredentialFields = syncStatus.config?.missingFields || [];
  const placeholderCredentialFields = syncStatus.config?.placeholderFields || [];
  const canSync = Boolean(syncStatus.config?.canSync);
  const hasSyncConfigurationIssue = !canSync;
  const syncInProgress = syncing || Boolean(syncStatus.syncing);
  const syncIsPublic = syncStatus.config?.accessMode === 'public';

  return {
    obrasSociales,
    loading,
    syncing,
    search,
    setSearch,
    filtroEstado,
    setFiltroEstado,
    filtroZona,
    setFiltroZona,
    stats,
    selectedReportMonth,
    setSelectedReportMonth,
    coinsuranceReport,
    reportLoading,
    syncStatus,
    expandedId,
    setExpandedId,
    editingId,
    setEditingId,
    editForm,
    setEditForm,
    savingId,
    deletingId,
    showCreateForm,
    setShowCreateForm,
    createForm,
    setCreateForm,
    creating,
    sortField,
    sortDir,
    filtered,
    handleSort,
    fetchObrasSociales,
    fetchCoinsuranceReport,
    startEdit,
    cancelEdit,
    saveEdit,
    createManualObraSocial,
    removeFromGrid,
    handleSync,
    currentMonthValue,
    canMoveReportForward,
    missingCredentialFields,
    placeholderCredentialFields,
    canSync,
    hasSyncConfigurationIssue,
    syncInProgress,
    syncIsPublic,
  };
};
