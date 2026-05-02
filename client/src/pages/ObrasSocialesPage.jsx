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
} from 'lucide-react';
import { showErrorToast, showSuccessToast } from '../components/toastHelpers';

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
    parseFloat(value) || 0
  );

const ObrasSocialesPage = () => {
  const [obrasSociales, setObrasSociales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Activa');
  const [filtroZona, setFiltroZona] = useState('');
  const [stats, setStats] = useState({ total: 0, activas: 0, sanMiguel: 0 });
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
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroZona === 'san-miguel') params.zona = 'san-miguel';

      const [osRes, statsRes] = await Promise.all([
        instance.get('/obras-sociales', { params }),
        instance.get('/obras-sociales/stats'),
      ]);

      setObrasSociales(osRes.data);
      setStats(statsRes.data);
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
      plazoPago: os.plazoPago || 60,
      atendibleSanMiguel: os.atendibleSanMiguel || false,
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
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Obras Sociales</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Prestadoras sincronizadas desde COKIBA · Honorarios y coseguros de Categoría Básica
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchObrasSociales()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
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
              <option value="">Todos los estados</option>
              <option value="Activa">Activas</option>
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
                  ? 'Ejecutá el scraper COKIBA para sincronizar: npm run cokiba-sync'
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
                      <th className="p-4 text-center">Plazo</th>
                      <th className="p-4 text-center">Zona</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((os) => {
                      const isEditing = editingId === os.id;
                      const isSaving = savingId === os.id;

                      return (
                        <tr
                          key={os.id}
                          className={`border-b border-slate-100 transition-colors ${
                            isEditing
                              ? 'bg-teal-50/40'
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
                          <td className="p-4 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editForm.plazoPago}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    plazoPago: parseInt(e.target.value) || 60,
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
                            ) : os.atendibleSanMiguel ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
                                <MapPin size={12} />
                                SM/BV
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
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
                              <button
                                type="button"
                                onClick={() => startEdit(os)}
                                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title="Editar valores"
                              >
                                <Edit3 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
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
                            <div className="col-span-2">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Zona San Miguel / Bella Vista
                              </p>
                              <p className="mt-0.5 font-bold text-slate-700">
                                {os.atendibleSanMiguel ? '✅ Sí' : '❌ No'}
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
