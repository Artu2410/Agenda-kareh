import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Power, Save, X } from 'lucide-react';
import instance from '../../api/axios';

const COVERAGE_CATEGORY_OPTIONS = [
  { value: 'obra_social', label: 'Obra Social' },
  { value: 'prepaga', label: 'Prepaga' },
  { value: 'art', label: 'ART' },
];

const createEmptyForm = () => ({
  name: '',
  category: 'obra_social',
  aliases: '',
  isActive: true,
  sortOrder: '',
});

const formatAliases = (aliases = []) => aliases.join(', ');

const getCoverageCategoryLabel = (value) => (
  COVERAGE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || 'Obra Social'
);

const WhatsAppCoverageSection = () => {
  const [coverages, setCoverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(createEmptyForm());

  const activeCount = useMemo(
    () => coverages.filter((coverage) => coverage.isActive).length,
    [coverages],
  );

  const fetchCoverages = async () => {
    try {
      setLoading(true);
      const response = await instance.get('/whatsapp/coverages', {
        params: { includeInactive: 1 },
      });
      setCoverages(response.data?.coverages || []);
      setError(null);
    } catch (err) {
      console.error('Error al cargar coberturas WhatsApp:', err);
      setError(err.response?.data?.message || 'No se pudieron cargar las coberturas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoverages();
  }, []);

  const resetForm = () => {
    setFormData(createEmptyForm());
    setEditingId(null);
  };

  const handleInputChange = (field) => (event) => {
    const nextValue = field === 'isActive' ? event.target.checked : event.target.value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleEditCoverage = (coverage) => {
    setEditingId(coverage.id);
    setFormData({
      name: coverage.name || '',
      category: coverage.category || 'obra_social',
      aliases: formatAliases(coverage.aliases || []),
      isActive: !!coverage.isActive,
      sortOrder: coverage.sortOrder ?? '',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: formData.name,
        category: formData.category,
        aliases: formData.aliases,
        isActive: formData.isActive,
        sortOrder: formData.sortOrder,
      };

      if (editingId) {
        await instance.put(`/whatsapp/coverages/${editingId}`, payload);
      } else {
        await instance.post('/whatsapp/coverages', payload);
      }

      resetForm();
      await fetchCoverages();
    } catch (err) {
      console.error('Error guardando cobertura WhatsApp:', err);
      setError(err.response?.data?.message || 'No se pudo guardar la cobertura.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coverage) => {
    try {
      setSaving(true);
      setError(null);

      await instance.put(`/whatsapp/coverages/${coverage.id}`, {
        name: coverage.name,
        category: coverage.category,
        aliases: coverage.aliases,
        isActive: !coverage.isActive,
        sortOrder: coverage.sortOrder,
      });

      await fetchCoverages();
    } catch (err) {
      console.error('Error actualizando estado de cobertura WhatsApp:', err);
      setError(err.response?.data?.message || 'No se pudo actualizar el estado de la cobertura.');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveCoverage = async (coverageId, direction) => {
    try {
      setSaving(true);
      setError(null);

      await instance.post(`/whatsapp/coverages/${coverageId}/move`, { direction });
      await fetchCoverages();
    } catch (err) {
      console.error('Error reordenando cobertura WhatsApp:', err);
      setError(err.response?.data?.message || 'No se pudo actualizar el orden de la cobertura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 p-6">
        <h2 className="text-xl font-bold text-slate-700">Coberturas de WhatsApp</h2>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {activeCount} activas de {coverages.length} cargadas
        </p>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-bold text-slate-700">
              {editingId ? 'Editar cobertura' : 'Nueva cobertura'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Cambiá alias, activá o desactivá convenios y el flujo de WhatsApp lo toma sin tocar código.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Nombre
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Ej. Swiss Medical"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Tipo
            </label>
            <select
              value={formData.category}
              onChange={handleInputChange('category')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
            >
              {COVERAGE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Alias
            </label>
            <textarea
              rows="4"
              value={formData.aliases}
              onChange={handleInputChange('aliases')}
              placeholder="Separalos por coma o una línea por alias"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Orden
            </label>
            <input
              type="number"
              min="0"
              value={formData.sortOrder}
              onChange={handleInputChange('sortOrder')}
              placeholder="Se agrega al final si lo dejás vacío"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
            <span>
              <span className="block text-sm font-bold text-slate-700">Cobertura activa</span>
              <span className="block text-xs text-slate-500">Si está inactiva, el bot no la reconoce.</span>
            </span>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={handleInputChange('isActive')}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : (editingId ? <Save size={18} /> : <Plus size={18} />)}
              {saving ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Agregar cobertura')}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
              >
                <X size={18} />
                Cancelar
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </div>
          )}
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-slate-500">
              <Loader2 className="animate-spin" size={16} />
              Cargando coberturas...
            </div>
          ) : (
            <div className="max-h-[620px] overflow-y-auto p-4">
              <div className="grid gap-3">
                {coverages.map((coverage, index) => (
                  <article
                    key={coverage.id}
                    className={`rounded-2xl border p-4 transition-all ${coverage.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/80'}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-800">
                            {coverage.name}
                          </h3>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${coverage.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {coverage.isActive ? 'Activa' : 'Inactiva'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {getCoverageCategoryLabel(coverage.category)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Orden {coverage.sortOrder}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {coverage.aliases?.length ? formatAliases(coverage.aliases) : 'Sin alias configurados.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => handleMoveCoverage(coverage.id, 'up')}
                          disabled={saving || index === 0}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Subir cobertura"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCoverage(coverage.id, 'down')}
                          disabled={saving || index === coverages.length - 1}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Bajar cobertura"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditCoverage(coverage)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                          title="Editar cobertura"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(coverage)}
                          disabled={saving}
                          className={`rounded-xl border p-2 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${coverage.isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                          title={coverage.isActive ? 'Desactivar cobertura' : 'Activar cobertura'}
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                {!coverages.length && (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    No hay coberturas cargadas.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default WhatsAppCoverageSection;
