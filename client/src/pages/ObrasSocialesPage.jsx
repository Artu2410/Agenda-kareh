import React, { useCallback, useEffect, useMemo, useState } from 'react';
import instance from '../api/axios';
import {
  Building2,
  Search,
  MapPin,
  Clock,
  DollarSign,
  Shield,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Banknote,
  Heart,
  Edit3,
  Save,
  X,
  AlertTriangle,
} from 'lucide-react';
import { showErrorToast, showSuccessToast } from '../components/toastHelpers';

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
    parseFloat(value) || 0
  );

const formatDateTime = (value) => {
  if (!value) return 'Nunca';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Nunca';
  return parsed.toLocaleString('es-AR');
};

const getCokibaDetails = (obraSocial) => {
  const details =
    obraSocial?.cokibaDetails && typeof obraSocial.cokibaDetails === 'object'
      ? obraSocial.cokibaDetails
      : {};

  const linkMap = new Map();
  const pushLink = (href, label) => {
    const normalizedHref = String(href || '').trim();
    if (!normalizedHref) return;
    if (!linkMap.has(normalizedHref)) {
      linkMap.set(normalizedHref, {
        href: normalizedHref,
        label: String(label || normalizedHref).trim(),
      });
    }
  };

  if (Array.isArray(details.links)) {
    details.links.forEach((link) => pushLink(link?.href, link?.text));
  }

  pushLink(details.convenioUrl, details.convenioLabel || 'Convenio');
  pushLink(details.validacionUrl, 'Validación afiliatoria');
  pushLink(details.autorizacionUrl, 'Autorización');

  return {
    arancelVigenteDesde: details.arancelVigenteDesde || '',
    cuit: details.cuit || '',
    areaCobertura: details.areaCobertura || '',
    coseguroTexto: details.coseguroTexto || '',
    observaciones: details.observaciones || '',
    numeroPrestador: details.numeroPrestador || '',
    authorizationNote: details.authorizationNote || '',
    norms: Array.isArray(details.norms) ? details.norms : [],
    tariffRows: Array.isArray(details.tariffRows) ? details.tariffRows : [],
    honorarioReferenciaPrestacion: details.honorarioReferenciaPrestacion || '',
    honorarioBasicaReferencia: parseFloat(details.honorarioBasicaReferencia) || 0,
    coinsuranceReliable: details.coinsuranceReliable !== false,
    links: [...linkMap.values()],
  };
};

const ObraSocialDetailPanel = ({ obraSocial }) => {
  const details = getCokibaDetails(obraSocial);
  const documents = Array.isArray(obraSocial?.requiredDocuments?.documents)
    ? obraSocial.requiredDocuments.documents
    : [];
  const additionalDocumentInfo = String(obraSocial?.requiredDocuments?.additionalInfo || '').trim();
  const notes = [details.observaciones, additionalDocumentInfo].filter(Boolean);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Estado y Referencias
          </p>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="font-bold text-slate-500">Estado detectado por COKIBA</p>
              <p className="mt-1 font-black text-slate-800">
                {obraSocial.detectedStatus || obraSocial.estado || 'Sin dato'}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {obraSocial.statusManualOverride
                  ? `Override manual activo. Estado aplicado: ${obraSocial.isActive ? 'Activa' : 'Inactiva'}.`
                  : 'Usando el estado automático detectado en COKIBA.'}
              </p>
            </div>
            {details.arancelVigenteDesde && (
              <div>
                <p className="font-bold text-slate-500">Arancel vigente desde</p>
                <p className="mt-1 font-semibold text-slate-800">{details.arancelVigenteDesde}</p>
              </div>
            )}
            {details.honorarioReferenciaPrestacion && (
              <div>
                <p className="font-bold text-slate-500">Honorario básico de referencia</p>
                <p className="mt-1 font-black text-teal-700">
                  {formatCurrency(details.honorarioBasicaReferencia)} · {details.honorarioReferenciaPrestacion}
                </p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {details.cuit && (
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CUIT</p>
                  <p className="mt-1 font-semibold text-slate-700">{details.cuit}</p>
                </div>
              )}
              {details.numeroPrestador && (
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">N° Prestador</p>
                  <p className="mt-1 font-semibold text-slate-700">{details.numeroPrestador}</p>
                </div>
              )}
            </div>
            {details.areaCobertura && (
              <div>
                <p className="font-bold text-slate-500">Área de cobertura</p>
                <p className="mt-1 font-semibold text-slate-800">{details.areaCobertura}</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Coseguro y Documentación
          </p>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="font-bold text-slate-500">Texto de coseguro informado por COKIBA</p>
              <p className="mt-1 font-black text-amber-700">
                {details.coseguroTexto || formatCurrency(obraSocial.coseguroValor)}
              </p>
              {!details.coinsuranceReliable && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  El texto de COKIBA es complejo. El importe por sesión puede requerir revisión manual.
                </p>
              )}
            </div>

            {documents.length > 0 ? (
              <div>
                <p className="font-bold text-slate-500">Documentación requerida</p>
                <div className="mt-2 grid gap-2">
                  {documents.map((document) => (
                    <div key={document.name} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="font-semibold text-slate-800">{document.name}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        {document.mandatory ? 'Obligatorio' : 'Opcional'}
                        {document.validityDays ? ` · ${document.validityDays} días` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="font-bold text-slate-500">Documentación requerida</p>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  No se detectó una lista estructurada en COKIBA.
                </p>
              </div>
            )}

            {details.authorizationNote && (
              <div>
                <p className="font-bold text-slate-500">Autorización</p>
                <p className="mt-1 font-semibold text-slate-800">{details.authorizationNote}</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Observaciones y Enlaces
          </p>
          <div className="mt-3 space-y-3 text-sm">
            {notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note) => (
                  <p
                    key={note}
                    className="whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 font-medium text-slate-700"
                  >
                    {note}
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-semibold text-slate-400">Sin observaciones extraídas.</p>
            )}

            {details.links.length > 0 && (
              <div>
                <p className="font-bold text-slate-500">Links útiles</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {details.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {details.norms.length > 0 && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Normas de Facturación
          </p>
          <div className="mt-3 grid gap-2">
            {details.norms.map((line) => (
              <div key={line} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {line}
              </div>
            ))}
          </div>
        </section>
      )}

      {details.tariffRows.length > 0 && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Aranceles por Categoría
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <th className="pb-2 pr-4">Prestación</th>
                  <th className="pb-2 pr-4 text-right">Básica</th>
                  <th className="pb-2 pr-4 text-right">A</th>
                  <th className="pb-2 pr-4 text-right">B</th>
                  <th className="pb-2 text-right">C</th>
                </tr>
              </thead>
              <tbody>
                {details.tariffRows.map((row) => (
                  <tr key={`${row.prestacion}-${row.categoriaBasica}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-4 font-semibold text-slate-700">{row.prestacion}</td>
                    <td className="py-2 pr-4 text-right font-black text-teal-700">{formatCurrency(row.categoriaBasica)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-slate-600">{formatCurrency(row.categoriaA)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-slate-600">{formatCurrency(row.categoriaB)}</td>
                    <td className="py-2 text-right font-semibold text-slate-600">{formatCurrency(row.categoriaC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

const ObrasSocialesPage = () => {
  const [obrasSociales, setObrasSociales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('active');
  const [filtroZona, setFiltroZona] = useState('');
  const [stats, setStats] = useState({ total: 0, activas: 0, sanMiguel: 0 });
  const [coinsuranceReport, setCoinsuranceReport] = useState({ month: '', totalAmount: 0, rows: [] });
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

      const currentMonth = new Date();
      const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

      const [osRes, statsRes, syncStatusRes, reportRes] = await Promise.all([
        instance.get('/obras-sociales', { params }),
        instance.get('/obras-sociales/stats'),
        instance.get('/obras-sociales/status'),
        instance.get('/obras-sociales/coinsurance-report', { params: { month } }),
      ]);

      setObrasSociales(osRes.data);
      setStats(statsRes.data);
      setSyncStatus(syncStatusRes.data);
      setCoinsuranceReport(reportRes.data || { month, totalAmount: 0, rows: [] });
    } catch (error) {
      console.error('Error fetching obras sociales:', error);
      showErrorToast('No se pudieron cargar las obras sociales.');
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroZona]);

  useEffect(() => {
    void fetchObrasSociales();
  }, [fetchObrasSociales]);

  const filtered = useMemo(() => {
    let list = [...obrasSociales];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (os) =>
          os.nombreOs.toLowerCase().includes(q) ||
          os.codigoCokiba.toLowerCase().includes(q)
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
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1" />
    ) : (
      <ChevronDown size={14} className="inline ml-1" />
    );
  };

  const startEdit = (os) => {
    setEditingId(os.id);
    setEditForm({
      coseguroValor: parseFloat(os.coseguroValor) || 0,
      honorarioEstimado: parseFloat(os.honorarioEstimado) || 0,
      percentageCoinsurance: parseFloat(os.percentageCoinsurance) || 0,
      fixedCopay: parseFloat(os.fixedCopay) || 0,
      plazoPago: os.plazoPago || 60,
      atendibleSanMiguel: os.atendibleSanMiguel || false,
      isActive: os.isActive ?? true,
      statusManualOverride: os.statusManualOverride ?? false,
      requiresAuthorization: os.requiresAuthorization ?? false,
      requiredDocuments: JSON.stringify(os.requiredDocuments || { documents: [], additionalInfo: '' }, null, 2),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id) => {
    try {
      setSavingId(id);
      await instance.put(`/obras-sociales/${id}`, editForm);
      await fetchObrasSociales();
      setEditingId(null);
      setEditForm({});
      showSuccessToast('Obra social actualizada.');
    } catch (error) {
      console.error('Error updating:', error);
      showErrorToast('No se pudo actualizar la obra social.');
    } finally {
      setSavingId(null);
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
      console.error('Error syncing obras sociales:', error);
      const message =
        error?.response?.data?.message ||
        error?.friendlyMessage ||
        'No se pudo sincronizar con COKIBA.';
      showErrorToast(message);
    } finally {
      setSyncing(false);
    }
  };

  const summaryCards = [
    {
      key: 'total',
      label: 'Total Registradas',
      value: stats.total,
      icon: Building2,
      iconWrapperClassName: 'bg-slate-100',
      iconClassName: 'text-slate-600',
      valueClassName: 'text-slate-800',
    },
    {
      key: 'activas',
      label: 'Obras Sociales Activas',
      value: stats.activas,
      icon: CheckCircle,
      iconWrapperClassName: 'bg-emerald-100',
      iconClassName: 'text-emerald-600',
      valueClassName: 'text-emerald-700',
    },
    {
      key: 'san-miguel',
      label: 'Zona San Miguel / B. Vista',
      value: stats.sanMiguel,
      icon: MapPin,
      iconWrapperClassName: 'bg-violet-100',
      iconClassName: 'text-violet-600',
      valueClassName: 'text-violet-700',
    },
    {
      key: 'requires-auth',
      label: 'Requieren autorización',
      value: stats.requierenAutorizacion || 0,
      icon: Shield,
      iconWrapperClassName: 'bg-amber-100',
      iconClassName: 'text-amber-600',
      valueClassName: 'text-amber-700',
    },
  ];

  const missingCredentialFields = syncStatus.config?.missingFields || [];
  const placeholderCredentialFields = syncStatus.config?.placeholderFields || [];
  const canSync = Boolean(syncStatus.config?.canSync);
  const hasSyncConfigurationIssue = !canSync;
  const syncInProgress = syncing || Boolean(syncStatus.syncing);
  const syncIsPublic = syncStatus.config?.accessMode === 'public';

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Obras Sociales</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Prestadoras sincronizadas desde COKIBA · Estado, documentación, aranceles y coseguros de Categoría Básica
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncInProgress || !canSync}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              title={
                !canSync
                  ? 'No se pudo preparar la sincronización de COKIBA.'
                  : 'Sincronizar ahora con COKIBA'
              }
            >
              <RefreshCw size={18} className={syncInProgress ? 'animate-spin' : ''} />
              {syncInProgress ? 'Sincronizando...' : 'Sincronizar COKIBA'}
            </button>
            <button
              type="button"
              onClick={() => fetchObrasSociales()}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-50 sm:w-auto"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Recargar
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Estado de Sincronización
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Última sincronización: {formatDateTime(syncStatus.lastSyncAt)}
              </p>
              <p className="text-sm text-slate-500">
                Registros disponibles: {syncStatus.total || 0}
                {syncStatus.lastSyncedRecord ? ` · Última OS detectada: ${syncStatus.lastSyncedRecord}` : ''}
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
                hasSyncConfigurationIssue
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <AlertTriangle size={14} />
              {hasSyncConfigurationIssue
                ? 'Sincronización pendiente'
                : syncIsPublic
                  ? 'Modo público COKIBA'
                  : 'COKIBA listo para sincronizar'}
            </div>
          </div>

          {hasSyncConfigurationIssue && missingCredentialFields.length > 0 && (
            <p className="mt-3 text-sm text-amber-700">
              Faltan variables en `server/.env`: {missingCredentialFields.join(', ')}.
            </p>
          )}

          {hasSyncConfigurationIssue && placeholderCredentialFields.length > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Hay variables con valores de ejemplo: {placeholderCredentialFields.join(', ')}.
            </p>
          )}

          {!hasSyncConfigurationIssue && syncIsPublic && (
            <p className="mt-3 text-sm text-emerald-700">
              La sincronización usa la publicación pública de COKIBA. Las credenciales en `server/.env` quedan como opcionales.
            </p>
          )}
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className="flex min-w-0 items-start gap-4 rounded-2xl bg-white p-6 shadow-md"
              >
                <div className={`shrink-0 rounded-full p-3 ${card.iconWrapperClassName}`}>
                  <Icon className={card.iconClassName} size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-500">{card.label}</p>
                  <p
                    className={`mt-2 text-2xl font-bold leading-tight ${card.valueClassName}`}
                  >
                    {card.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar obra social por nombre o código..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 shadow-sm outline-none transition focus:border-teal-400"
            >
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
              <option value="requires-auth">Requieren autorización</option>
              <option value="">Todas</option>
            </select>
            <select
              value={filtroZona}
              onChange={(e) => setFiltroZona(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 shadow-sm outline-none transition focus:border-teal-400"
            >
              <option value="">Todas las zonas</option>
              <option value="san-miguel">San Miguel / B. Vista</option>
            </select>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Reporte mensual de coseguros</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Mes analizado: {coinsuranceReport.month || 'actual'}</p>
            </div>
            <p className="text-2xl font-black text-teal-700">
              {formatCurrency(coinsuranceReport.totalAmount || 0)}
            </p>
          </div>
          {coinsuranceReport.rows?.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {coinsuranceReport.rows.slice(0, 6).map((row) => (
                <div key={row.obraSocialId || row.obraSocialName} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-800">{row.obraSocialName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{row.appointmentCount} turnos</p>
                  <p className="mt-2 text-sm font-black text-teal-700">{formatCurrency(row.totalAmount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-md">
          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12">
              <RefreshCw size={20} className="animate-spin text-teal-500" />
              <p className="text-sm font-medium text-slate-500">
                Cargando obras sociales...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-bold text-slate-500">
                No se encontraron obras sociales
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {obrasSociales.length === 0
                  ? hasSyncConfigurationIssue
                    ? 'No se pudo preparar la sincronización desde COKIBA.'
                    : 'Todavía no hay datos sincronizados. Usá el botón "Sincronizar COKIBA".'
                  : 'Probá cambiando los filtros o la búsqueda.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                      <th
                        className="cursor-pointer p-4 hover:text-slate-700"
                        onClick={() => handleSort('nombreOs')}
                      >
                        Obra Social <SortIcon field="nombreOs" />
                      </th>
                      <th
                        className="cursor-pointer p-4 text-right hover:text-slate-700"
                        onClick={() => handleSort('coseguroValor')}
                      >
                        Coseguro <SortIcon field="coseguroValor" />
                      </th>
                      <th
                        className="cursor-pointer p-4 text-right hover:text-slate-700"
                        onClick={() => handleSort('honorarioEstimado')}
                      >
                        Honorario <SortIcon field="honorarioEstimado" />
                      </th>
                      <th className="p-4 text-right">Copago fijo</th>
                      <th className="p-4 text-center">Plazo</th>
                      <th className="p-4 text-center">Zona / Estado</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((os) => {
                      const isExpanded = expandedId === os.id;
                      const isEditing = editingId === os.id;
                      const isSaving = savingId === os.id;
                      const details = getCokibaDetails(os);

                      return (
                        <React.Fragment key={os.id}>
                          <tr
                            className={`border-b border-slate-100 transition-colors ${
                              isEditing
                                ? 'bg-teal-50/40'
                                : isExpanded
                                  ? 'bg-slate-50/60'
                                  : 'bg-white/70 hover:bg-white'
                            }`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-[11px] font-black text-white shadow">
                                  {os.nombreOs.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-800">
                                    {os.nombreOs}
                                  </p>
                                  <p className="text-[11px] font-medium text-slate-400">
                                    {os.codigoCokiba}
                                    {details.arancelVigenteDesde ? ` · Arancel ${details.arancelVigenteDesde}` : ''}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.coseguroValor}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      coseguroValor: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded-lg border border-teal-300 bg-white px-2 py-1 text-right text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
                                />
                              ) : (
                                <span className="text-sm font-bold text-amber-700">
                                  {formatCurrency(os.coseguroValor)}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.honorarioEstimado}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      honorarioEstimado: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded-lg border border-teal-300 bg-white px-2 py-1 text-right text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
                                />
                              ) : (
                                <span className="text-sm font-bold text-teal-700">
                                  {formatCurrency(os.honorarioEstimado)}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.fixedCopay}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      fixedCopay: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded-lg border border-teal-300 bg-white px-2 py-1 text-right text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
                                />
                              ) : (
                                <span className="text-sm font-bold text-slate-700">
                                  {formatCurrency(os.fixedCopay)}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.plazoPago}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      plazoPago: parseInt(e.target.value, 10) || 60,
                                    }))
                                  }
                                  className="w-16 rounded-lg border border-teal-300 bg-white px-2 py-1 text-center text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-200"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                  <Clock size={12} />
                                  {os.plazoPago}d
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((f) => ({
                                        ...f,
                                        atendibleSanMiguel: !f.atendibleSanMiguel,
                                      }))
                                    }
                                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                                      editForm.atendibleSanMiguel
                                        ? 'bg-violet-100 text-violet-700'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    {editForm.atendibleSanMiguel ? '✓ Zona' : '✗ Zona'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((f) => ({
                                        ...f,
                                        statusManualOverride: true,
                                        isActive: !f.isActive,
                                      }))
                                    }
                                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                                      editForm.isActive
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-rose-100 text-rose-700'
                                    }`}
                                  >
                                    {editForm.isActive ? 'Activa' : 'Inactiva'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((f) => ({
                                        ...f,
                                        statusManualOverride: !f.statusManualOverride,
                                        isActive: f.statusManualOverride
                                          ? (os.detectedIsActive ?? os.isActive ?? true)
                                          : f.isActive,
                                      }))
                                    }
                                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                                      editForm.statusManualOverride
                                        ? 'bg-sky-100 text-sky-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {editForm.statusManualOverride ? 'Manual' : 'Auto COKIBA'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((f) => ({
                                        ...f,
                                        requiresAuthorization: !f.requiresAuthorization,
                                      }))
                                    }
                                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                                      editForm.requiresAuthorization
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    {editForm.requiresAuthorization ? 'Autoriza' : 'Libre'}
                                  </button>
                                  <p className="text-[11px] font-semibold text-slate-500">
                                    Detectado: {os.detectedStatus || 'Activa'}
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  {os.atendibleSanMiguel ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
                                      <MapPin size={12} />
                                      SM/BV
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                                      Sin zona
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                                    os.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {os.isActive ? 'Activa' : 'Inactiva'}
                                  </span>
                                  {os.statusManualOverride && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">
                                      Manual
                                    </span>
                                  )}
                                  {os.requiresAuthorization && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                                      Autorización
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(os.id)}
                                    disabled={isSaving}
                                    className="rounded-full p-2 text-teal-600 transition-colors hover:bg-teal-50 disabled:opacity-50"
                                    title="Guardar"
                                  >
                                    <Save size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100"
                                    title="Cancelar"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : os.id)}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                    title="Ver detalle"
                                  >
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(os)}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                    title="Editar valores"
                                  >
                                    <Edit3 size={18} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {isExpanded && !isEditing && (
                            <tr className="border-b border-slate-100 bg-white">
                              <td colSpan={7} className="p-4 pt-0">
                                <ObraSocialDetailPanel obraSocial={os} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 p-4 md:hidden">
                {filtered.map((os) => {
                  const isExpanded = expandedId === os.id;
                  const isEditing = editingId === os.id;
                  const isSaving = savingId === os.id;
                  const details = getCokibaDetails(os);

                  return (
                    <article
                      key={os.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : os.id)
                        }
                        className="flex w-full items-center gap-3 p-4 text-left"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-xs font-black text-white shadow">
                          {os.nombreOs.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {os.nombreOs}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-700">
                              Coseg: {formatCurrency(os.coseguroValor)}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs font-bold text-teal-700">
                              Hon: {formatCurrency(os.honorarioEstimado)}
                            </span>
                          </div>
                          {details.arancelVigenteDesde && (
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">
                              Arancel {details.arancelVigenteDesde}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {os.atendibleSanMiguel && (
                            <MapPin size={16} className="text-violet-500" />
                          )}
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Código COKIBA
                              </p>
                              <p className="mt-0.5 font-bold text-slate-700">
                                {os.codigoCokiba}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Plazo pago
                              </p>
                              <p className="mt-0.5 font-bold text-slate-700">
                                {os.plazoPago} días
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Coseguro
                              </p>
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.coseguroValor}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      coseguroValor: e.target.value,
                                    }))
                                  }
                                  className="mt-0.5 w-full rounded-lg border border-teal-300 bg-white px-2 py-1 text-sm font-bold outline-none"
                                />
                              ) : (
                                <p className="mt-0.5 font-black text-amber-700">
                                  {formatCurrency(os.coseguroValor)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Honorario
                              </p>
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.honorarioEstimado}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      honorarioEstimado: e.target.value,
                                    }))
                                  }
                                  className="mt-0.5 w-full rounded-lg border border-teal-300 bg-white px-2 py-1 text-sm font-bold outline-none"
                                />
                              ) : (
                                <p className="mt-0.5 font-black text-teal-700">
                                  {formatCurrency(os.honorarioEstimado)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Copago fijo
                              </p>
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.fixedCopay}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      fixedCopay: e.target.value,
                                    }))
                                  }
                                  className="mt-0.5 w-full rounded-lg border border-teal-300 bg-white px-2 py-1 text-sm font-bold outline-none"
                                />
                              ) : (
                                <p className="mt-0.5 font-black text-slate-700">
                                  {formatCurrency(os.fixedCopay)}
                                </p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Zona San Miguel / Bella Vista
                              </p>
                              <p className="mt-0.5 font-bold text-slate-700">
                                {os.atendibleSanMiguel ? '✅ Sí' : '❌ No'}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Estado / Autorización
                              </p>
                              <p className="mt-0.5 font-bold text-slate-700">
                                {os.isActive ? 'Activa' : 'Inactiva'} · {os.requiresAuthorization ? 'Requiere autorización' : 'Sin autorización previa'}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Detectado: {os.detectedStatus || 'Activa'}
                                {os.statusManualOverride ? ' · Override manual activo' : ''}
                              </p>
                            </div>
                            {os.ultimaSync && (
                              <div className="col-span-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Última sincronización
                                </p>
                                <p className="mt-0.5 text-xs font-medium text-slate-500">
                                  {new Date(os.ultimaSync).toLocaleString('es-AR')}
                                </p>
                              </div>
                            )}
                          </div>
                          {isEditing && (
                            <div className="mt-3 grid gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((f) => ({
                                    ...f,
                                    atendibleSanMiguel: !f.atendibleSanMiguel,
                                  }))
                                }
                                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                                  editForm.atendibleSanMiguel
                                    ? 'bg-violet-100 text-violet-700'
                                    : 'bg-white text-slate-500'
                                }`}
                              >
                                {editForm.atendibleSanMiguel ? 'Zona SM/BV activa' : 'Sin zona SM/BV'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((f) => ({
                                    ...f,
                                    statusManualOverride: true,
                                    isActive: !f.isActive,
                                  }))
                                }
                                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                                  editForm.isActive
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {editForm.isActive ? 'Marcar activa' : 'Marcar inactiva'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((f) => ({
                                    ...f,
                                    statusManualOverride: !f.statusManualOverride,
                                    isActive: f.statusManualOverride
                                      ? (os.detectedIsActive ?? os.isActive ?? true)
                                      : f.isActive,
                                  }))
                                }
                                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                                  editForm.statusManualOverride
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'bg-white text-slate-500'
                                }`}
                              >
                                {editForm.statusManualOverride ? 'Estado manual' : 'Usar auto COKIBA'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((f) => ({
                                    ...f,
                                    requiresAuthorization: !f.requiresAuthorization,
                                  }))
                                }
                                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                                  editForm.requiresAuthorization
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-white text-slate-500'
                                }`}
                              >
                                {editForm.requiresAuthorization ? 'Requiere autorización' : 'Sin autorización'}
                              </button>
                            </div>
                          )}
                          <div className="mt-4">
                            <ObraSocialDetailPanel obraSocial={os} />
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(os.id)}
                                  disabled={isSaving}
                                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(os)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
                              >
                                <Edit3 size={14} /> Editar
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Footer count */}
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-bold text-slate-400">
                  {filtered.length} de {obrasSociales.length} obras sociales mostradas
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObrasSocialesPage;
