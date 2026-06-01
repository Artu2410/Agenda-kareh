import React from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Banknote,
  Heart,
  Edit3,
  Save,
  X,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useObrasSociales, createEmptyManualForm, shiftMonthValue } from '../hooks/useObrasSociales';
import { getCokibaDetails } from '../utils/obrasSociales';

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

const REPORT_ADJUSTMENTS_STORAGE_KEY = 'obras-sociales-report-adjustments';

const readStoredReportAdjustments = () => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(REPORT_ADJUSTMENTS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const parseReportAdjustmentValue = (value) => {
  const parsed = Number.parseFloat(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCoverageHighlights = (areaCobertura = '') => {
  const text = String(areaCobertura || '');
  const hasProvincia = /provincia de buenos aires/i.test(text);
  const hasSanMiguel = /san miguel/i.test(text);
  const hasBellaVista = /bella vista/i.test(text);

  return { hasProvincia, hasSanMiguel, hasBellaVista };
};

const renderCoverageText = (areaCobertura = '') => {
  const source = String(areaCobertura || '').trim();
  if (!source) {
    return <span className="text-slate-400">Sin dato de cobertura.</span>;
  }

  return source.split(/(Provincia de Buenos Aires|San Miguel|Bella Vista)/gi).map((chunk, index) => {
    const normalized = chunk.trim().toLowerCase();
    const isHighlight =
      normalized === 'provincia de buenos aires' ||
      normalized === 'san miguel' ||
      normalized === 'bella vista';

    if (!isHighlight) {
      return <span key={`${chunk}-${index}`}>{chunk}</span>;
    }

    return (
      <span
        key={`${chunk}-${index}`}
        className="rounded-lg bg-emerald-100 px-2 py-1 text-lg font-black text-emerald-800"
      >
        {chunk}
      </span>
    );
  });
};

const getImportantLinks = (links = []) => {
  const items = Array.isArray(links) ? links : [];
  const scoreLink = (link) => {
    const text = `${link?.label || ''} ${link?.href || ''}`.toLowerCase();
    if (/autoriz/.test(text)) return 0;
    if (/valid|directconnection|prestador|afiliatoria/.test(text)) return 1;
    if (/convenio/.test(text)) return 2;
    if (/manual/.test(text)) return 3;
    return 4;
  };

  const unique = [];
  const seen = new Set();

  items
    .filter((link) => link?.href)
    .sort((a, b) => scoreLink(a) - scoreLink(b))
    .forEach((link) => {
      if (seen.has(link.href)) return;
      seen.add(link.href);
      unique.push(link);
    });

  return unique.slice(0, 4);
};

const formatLinkLabel = (link) => {
  const label = String(link?.label || '').trim();
  const href = String(link?.href || '').trim();
  const text = `${label} ${href}`.toLowerCase();

  if (/autoriz/.test(text)) return 'Autorización';
  if (/valid|directconnection|prestador|afiliatoria/.test(text)) return 'Validación';
  if (/convenio/.test(text)) return 'Convenio';
  if (/manual/.test(text)) return 'Manual';
  if (label && !/^https?:\/\//i.test(label)) return label;
  return 'Abrir link';
};

const ObraSocialSupplementalEditor = ({ form, setForm, showName = false, showCode = false }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
      Datos de Tu Grilla
    </p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {showName && (
        <label className="md:col-span-2">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Nombre</span>
          <input
            type="text"
            value={form.nombreOs}
            onChange={(event) => setForm((current) => ({ ...current, nombreOs: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </label>
      )}

      {showCode && (
        <label>
          <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Código manual</span>
          <input
            type="text"
            value={form.codigoCokiba}
            onChange={(event) => setForm((current) => ({ ...current, codigoCokiba: event.target.value }))}
            placeholder="Opcional"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </label>
      )}

      <label className={showCode ? '' : 'md:col-span-2'}>
        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Coseguro visible</span>
        <input
          type="text"
          value={form.coseguroTexto}
          onChange={(event) => setForm((current) => ({ ...current, coseguroTexto: event.target.value }))}
          placeholder="Ej: NO POSEE"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label className="md:col-span-2">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Área de cobertura</span>
        <textarea
          rows={3}
          value={form.areaCobertura}
          onChange={(event) => setForm((current) => ({ ...current, areaCobertura: event.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label>
        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Documentación</span>
        <textarea
          rows={5}
          value={form.documentLines}
          onChange={(event) => setForm((current) => ({ ...current, documentLines: event.target.value }))}
          placeholder={'Una por línea\nEj: Derivación médica (60 días)'}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label>
        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Info extra documentación</span>
        <textarea
          rows={5}
          value={form.additionalDocumentInfo}
          onChange={(event) => setForm((current) => ({ ...current, additionalDocumentInfo: event.target.value }))}
          placeholder="Autorización, validación, notas operativas..."
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label className="md:col-span-2">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Links útiles</span>
        <textarea
          rows={4}
          value={form.usefulLinks}
          onChange={(event) => setForm((current) => ({ ...current, usefulLinks: event.target.value }))}
          placeholder={'Uno por línea\nhttps://...'}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>
    </div>
  </section>
);

const ObraSocialDetailPanel = ({ obraSocial }) => {
  const details = getCokibaDetails(obraSocial);
  const documents = Array.isArray(obraSocial?.requiredDocuments?.documents)
    ? obraSocial.requiredDocuments.documents
    : [];
  const additionalDocumentInfo = String(obraSocial?.requiredDocuments?.additionalInfo || '').trim();
  const bonusAmounts = Array.isArray(details.bonusAmounts) ? details.bonusAmounts : [];
  const { hasProvincia, hasSanMiguel, hasBellaVista } = getCoverageHighlights(details.areaCobertura);
  const importantLinks = getImportantLinks(details.links);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Área de Cobertura
          </p>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {hasProvincia && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black uppercase tracking-[0.16em] text-emerald-800">
                  Provincia de Buenos Aires
                </span>
              )}
              {hasSanMiguel && (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black uppercase tracking-[0.16em] text-violet-800">
                  San Miguel
                </span>
              )}
              {hasBellaVista && (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black uppercase tracking-[0.16em] text-violet-800">
                  Bella Vista
                </span>
              )}
              <span className={`rounded-full px-3 py-1 text-sm font-black uppercase tracking-[0.16em] ${
                obraSocial.requiresAuthorization
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {obraSocial.requiresAuthorization ? 'Requiere autorización' : 'Sin autorización previa'}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-lg font-black leading-relaxed text-slate-800">
              {renderCoverageText(details.areaCobertura)}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Coseguro y Documentación
          </p>
          <div className="mt-3 space-y-4 text-sm">
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                Coseguro
              </p>
              <p className="mt-1 text-lg font-black text-amber-900">
                {details.coseguroTexto || formatCurrency(obraSocial.coseguroValor)}
              </p>
            </div>

            {bonusAmounts.length > 0 && (
              <div className="rounded-2xl bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                  Bonos detectados
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bonusAmounts.map((bonus) => (
                    <span
                      key={`${bonus.label}-${bonus.amount}`}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-800"
                    >
                      {bonus.label}: {formatCurrency(bonus.amount)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  Total bonos: {formatCurrency(details.bonusTotal || 0)}
                </p>
              </div>
            )}

            <div>
              <p className="font-black uppercase tracking-[0.18em] text-slate-500">
                Documentación requerida
              </p>
              {documents.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {documents.map((document) => (
                    <div key={document.name} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="font-semibold text-slate-800">{document.name}</p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        {document.validityDays ? `${document.validityDays} días` : 'Obligatorio'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  No se detectó documentación para pedir.
                </p>
              )}
              {!documents.length && additionalDocumentInfo && (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                  {additionalDocumentInfo}
                </p>
              )}
            </div>

            {importantLinks.length > 0 && (
              <div>
                <p className="font-black uppercase tracking-[0.18em] text-slate-500">
                  Links útiles
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {importantLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                    >
                      {formatLinkLabel(link)}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const ObrasSocialesPage = () => {
  const {
    obrasSociales,
    loading,
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
  } = useObrasSociales();

  const renderSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1" />
    ) : (
      <ChevronDown size={14} className="inline ml-1" />
    );
  };

  const [reportAdjustments, setReportAdjustments] = React.useState(readStoredReportAdjustments);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (Object.keys(reportAdjustments).length === 0) {
        window.localStorage.removeItem(REPORT_ADJUSTMENTS_STORAGE_KEY);
      } else {
        window.localStorage.setItem(REPORT_ADJUSTMENTS_STORAGE_KEY, JSON.stringify(reportAdjustments));
      }
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }, [reportAdjustments]);

  const reportMonthKey = selectedReportMonth || coinsuranceReport.month || currentMonthValue;
  const reportMonthAdjustments = reportAdjustments[reportMonthKey] || {};
  const reportAdjustmentTotal = Object.values(reportMonthAdjustments).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );

  const updateReportAdjustment = (rowKey, rawValue) => {
    setReportAdjustments((current) => {
      const nextMonthAdjustments = {
        ...(current[reportMonthKey] || {}),
      };

      if (String(rawValue || '').trim() === '') {
        delete nextMonthAdjustments[rowKey];
      } else {
        nextMonthAdjustments[rowKey] = parseReportAdjustmentValue(rawValue);
      }

      const nextAdjustments = { ...current };
      if (Object.keys(nextMonthAdjustments).length > 0) {
        nextAdjustments[reportMonthKey] = nextMonthAdjustments;
      } else {
        delete nextAdjustments[reportMonthKey];
      }

      return nextAdjustments;
    });
  };

  const getReportRowKey = (row = {}) => String(row.obraSocialId || row.obraSocialName || 'sin-obra-social');

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
              onClick={() => {
                setShowCreateForm((current) => !current);
                setCreateForm(createEmptyManualForm());
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              <Plus size={18} />
              {showCreateForm ? 'Cerrar alta manual' : 'Agregar manual'}
            </button>
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
              aria-label="Buscar obra social"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar obra social por nombre o código..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Filtro de estado"
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
              aria-label="Filtro de zona"
              value={filtroZona}
              onChange={(e) => setFiltroZona(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 shadow-sm outline-none transition focus:border-teal-400"
            >
              <option value="">Todas las zonas</option>
              <option value="san-miguel">San Miguel / B. Vista</option>
            </select>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Alta manual</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Agregá una obra social propia y dejala lista para tu grilla.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateForm(createEmptyManualForm());
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={createManualObraSocial}
                    disabled={creating}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {creating ? 'Guardando...' : 'Guardar obra social'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Coseguro</span>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.coseguroValor}
                    onChange={(event) => setCreateForm((current) => ({ ...current, coseguroValor: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label>
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Honorario</span>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.honorarioEstimado}
                    onChange={(event) => setCreateForm((current) => ({ ...current, honorarioEstimado: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label>
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Copago fijo</span>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.fixedCopay}
                    onChange={(event) => setCreateForm((current) => ({ ...current, fixedCopay: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label>
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Plazo pago</span>
                  <input
                    type="number"
                    value={createForm.plazoPago}
                    onChange={(event) => setCreateForm((current) => ({ ...current, plazoPago: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateForm((current) => ({ ...current, atendibleSanMiguel: !current.atendibleSanMiguel }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] transition ${
                    createForm.atendibleSanMiguel
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {createForm.atendibleSanMiguel ? 'Zona SM/BV' : 'Sin zona SM/BV'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateForm((current) => ({ ...current, isActive: !current.isActive }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] transition ${
                    createForm.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {createForm.isActive ? 'Activa' : 'Inactiva'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateForm((current) => ({ ...current, requiresAuthorization: !current.requiresAuthorization }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] transition ${
                    createForm.requiresAuthorization
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {createForm.requiresAuthorization ? 'Requiere autorización' : 'Sin autorización'}
                </button>
              </div>

              <ObraSocialSupplementalEditor
                form={createForm}
                setForm={setCreateForm}
                showName
                showCode
              />
            </div>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Honorarios por convenio</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Mes analizado: {coinsuranceReport.month || selectedReportMonth || 'actual'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Total estimado a cobrar. Excluye PAMI y OSDE.</p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReportMonth((current) => shiftMonthValue(current, -1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-teal-300 hover:text-teal-700"
                  aria-label="Ver mes anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="month"
                  value={selectedReportMonth}
                  max={currentMonthValue}
                  onChange={(event) => setSelectedReportMonth(event.target.value || currentMonthValue)}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="button"
                  onClick={() => setSelectedReportMonth((current) => shiftMonthValue(current, 1))}
                  disabled={!canMoveReportForward}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Ver mes siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <p className="text-2xl font-black text-teal-700">
                {formatCurrency((coinsuranceReport.totalAmount || 0) + reportAdjustmentTotal)}
              </p>
              {reportAdjustmentTotal !== 0 && (
                <p className="text-[11px] font-semibold text-slate-400">
                  Base: {formatCurrency(coinsuranceReport.totalAmount || 0)} · Ajustes: {formatCurrency(reportAdjustmentTotal)}
                </p>
              )}
            </div>
          </div>
          {reportLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <RefreshCw size={16} className="animate-spin text-teal-500" />
              Cargando reporte mensual...
            </div>
          ) : coinsuranceReport.rows?.length > 0 ? (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {coinsuranceReport.rows.slice(0, 6).map((row) => {
                const rowKey = getReportRowKey(row);
                const hasManualAdjustment = Object.prototype.hasOwnProperty.call(
                  reportMonthAdjustments,
                  rowKey
                );
                const manualAdjustment = hasManualAdjustment
                  ? Number(reportMonthAdjustments[rowKey]) || 0
                  : 0;
                const adjustedRowTotal = (Number(row.totalAmount) || 0) + manualAdjustment;

                return (
                  <div key={row.obraSocialId || row.obraSocialName} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-sm font-black text-slate-800">{row.obraSocialName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{row.appointmentCount} turnos</p>
                    <p className="mt-2 text-sm font-black text-teal-700">{formatCurrency(adjustedRowTotal)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">Honorarios estimados</p>
                    {Array.isArray(row.bonusDetails) && row.bonusDetails.length > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        Bonos detectados: {row.bonusDetails
                          .map((bonus) => `${bonus.label} ${formatCurrency(bonus.amount)}`)
                          .join(' · ')}
                      </p>
                    )}
                    {manualAdjustment !== 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        Base: {formatCurrency(row.totalAmount)} · Ajuste: {formatCurrency(manualAdjustment)}
                      </p>
                    )}
                    <label className="mt-3 block">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Ajuste manual
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={hasManualAdjustment ? manualAdjustment : ''}
                        onChange={(event) => updateReportAdjustment(rowKey, event.target.value)}
                        placeholder="0"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              No hay honorarios por convenio registrados para {coinsuranceReport.month || selectedReportMonth}.
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
                        Obra Social {renderSortIcon('nombreOs')}
                      </th>
                      <th
                        className="cursor-pointer p-4 text-right hover:text-slate-700"
                        onClick={() => handleSort('coseguroValor')}
                      >
                        Coseguro {renderSortIcon('coseguroValor')}
                      </th>
                      <th
                        className="cursor-pointer p-4 text-right hover:text-slate-700"
                        onClick={() => handleSort('honorarioEstimado')}
                      >
                        Honorario {renderSortIcon('honorarioEstimado')}
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
                                    onClick={() => saveEdit(os)}
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
                                  <button
                                    type="button"
                                    onClick={() => removeFromGrid(os)}
                                    disabled={deletingId === os.id}
                                    className="rounded-full p-2 text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                    title="Quitar de mi grilla"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="border-b border-slate-100 bg-white">
                              <td colSpan={7} className="p-4 pt-0">
                                {isEditing ? (
                                  <ObraSocialSupplementalEditor
                                    form={editForm}
                                    setForm={setEditForm}
                                    showName
                                  />
                                ) : (
                                  <ObraSocialDetailPanel obraSocial={os} />
                                )}
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
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
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
                          <div className="mt-1 flex flex-wrap items-center gap-2">
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
                          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
                                className="mt-0.5 w-full min-h-11 rounded-lg border border-teal-300 bg-white px-2 py-1 text-sm font-bold outline-none"
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
                                className="mt-0.5 w-full min-h-11 rounded-lg border border-teal-300 bg-white px-2 py-1 text-sm font-bold outline-none"
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
                                className="mt-0.5 w-full min-h-11 rounded-lg border border-teal-300 bg-white px-2 py-1 text-sm font-bold outline-none"
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
                            <>
                              <div className="mt-3 grid gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditForm((f) => ({
                                      ...f,
                                      atendibleSanMiguel: !f.atendibleSanMiguel,
                                    }))
                                  }
                                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition ${
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
                                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition ${
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
                                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition ${
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
                                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition ${
                                    editForm.requiresAuthorization
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-white text-slate-500'
                                  }`}
                                >
                                  {editForm.requiresAuthorization ? 'Requiere autorización' : 'Sin autorización'}
                                </button>
                              </div>

                              <div className="mt-4">
                                <ObraSocialSupplementalEditor
                                  form={editForm}
                                  setForm={setEditForm}
                                  showName
                                />
                              </div>
                            </>
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
                            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(os)}
                                  disabled={isSaving}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(os)}
                            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
                                >
                                  <Edit3 size={14} /> Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeFromGrid(os)}
                                  disabled={deletingId === os.id}
                            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  <Trash2 size={14} /> Quitar
                                </button>
                              </>
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
