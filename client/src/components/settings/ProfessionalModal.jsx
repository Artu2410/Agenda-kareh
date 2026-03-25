import React, { useMemo, useState } from 'react';
import {
  BadgeCheck,
  BriefcaseMedical,
  IdCard,
  Loader2,
  Save,
  ShieldAlert,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import instance from '../../api/axios';
import DocumentUploadField from '../DocumentUploadField';

const MAX_UPLOAD_MB = Number(import.meta.env.VITE_UPLOAD_MAX_MB || 25);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const PROFESSIONAL_DOCUMENTS = [
  { field: 'dniImageUrl', label: 'DNI frente' },
  { field: 'dniBackImageUrl', label: 'DNI dorso' },
  { field: 'licenseMNImageUrl', label: 'Matrícula MN frente' },
  { field: 'licenseMNBackImageUrl', label: 'Matrícula MN dorso' },
  { field: 'licenseMPImageUrl', label: 'Matrícula MP frente' },
  { field: 'licenseMPBackImageUrl', label: 'Matrícula MP dorso' },
  { field: 'degreeImageUrl', label: 'Título frente' },
  { field: 'degreeBackImageUrl', label: 'Título dorso' },
  { field: 'providerRegistryImageUrl', label: 'Registro de prestadores' },
  { field: 'malpracticeInsuranceImageUrl', label: 'Seguro de mala praxis' },
];

const createInitialState = (professional) => ({
  fullName: professional?.fullName || '',
  specialty: professional?.specialty || 'Kinesiología',
  type: professional?.type || 'MN',
  isActive: professional?.isActive ?? true,
  isArchived: professional?.isArchived ?? false,
  licenseNumber: professional?.licenseNumber || '',
  licenseNumberMP: professional?.licenseNumberMP || '',
  dni: professional?.dni || '',
  phone: professional?.phone || '',
  birthDate: professional?.birthDate ? String(professional.birthDate).split('T')[0] : '',
  address: professional?.address || '',
  emergencyPhone: professional?.emergencyPhone || '',
  medicalHistory: professional?.medicalHistory || '',
  dniImageUrl: professional?.dniImageUrl || '',
  dniBackImageUrl: professional?.dniBackImageUrl || '',
  licenseMNImageUrl: professional?.licenseMNImageUrl || '',
  licenseMNBackImageUrl: professional?.licenseMNBackImageUrl || '',
  licenseMPImageUrl: professional?.licenseMPImageUrl || '',
  licenseMPBackImageUrl: professional?.licenseMPBackImageUrl || '',
  degreeImageUrl: professional?.degreeImageUrl || '',
  degreeBackImageUrl: professional?.degreeBackImageUrl || '',
  providerRegistryImageUrl: professional?.providerRegistryImageUrl || '',
  malpracticeInsuranceImageUrl: professional?.malpracticeInsuranceImageUrl || '',
});

const ProfessionalModal = ({ isOpen, onClose, onSave, onDeleted, professional }) => {
  const [formData, setFormData] = useState(() => createInitialState(professional));
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isNewProfessional = !professional?.id;

  const uploadedDocuments = useMemo(
    () => PROFESSIONAL_DOCUMENTS.filter((item) => formData[item.field]),
    [formData]
  );

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const patchProfessionalField = async (field, value) => {
    if (!professional?.id) return;
    await instance.put(`/professionals/${professional.id}`, { [field]: value });
    setFormData((prev) => ({ ...prev, [field]: value || '' }));
  };

  const handleUploadDocument = async (field, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (isNewProfessional || !professional?.id) {
      alert('Primero guarda el profesional para poder adjuntar documentación.');
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      alert(`Archivo demasiado grande. Máximo ${MAX_UPLOAD_MB}MB.`);
      return;
    }

    try {
      setUploadingField(field);
      const payload = new FormData();
      payload.append('file', file);
      payload.append('professionalId', professional.id);
      payload.append('scope', 'professional-documents');

      const response = await instance.post('/uploads', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await patchProfessionalField(field, response.data?.url || '');
    } catch (uploadError) {
      console.error(uploadError);
      alert(uploadError?.response?.data?.message || 'No se pudo subir el archivo.');
    } finally {
      setUploadingField('');
    }
  };

  const handleRemoveDocument = async (field) => {
    if (!professional?.id) return;
    const confirmed = window.confirm('¿Quieres quitar este archivo de la ficha del profesional?');
    if (!confirmed) return;

    try {
      setUploadingField(field);
      await patchProfessionalField(field, null);
    } catch (removeError) {
      console.error(removeError);
      alert(removeError?.response?.data?.message || 'No se pudo quitar el archivo.');
    } finally {
      setUploadingField('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.fullName.trim() || !formData.licenseNumber.trim()) return;

    setSaving(true);
    setError('');

    try {
      const payload = professional ? { ...formData, id: professional.id } : formData;
      const success = await onSave(payload);
      if (success !== false) {
        onClose();
      }
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el profesional.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!professional?.id) return;

    setSaving(true);
    setError('');

    try {
      await instance.delete(`/professionals/${professional.id}`);
      await onDeleted?.();
      onClose();
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'No se pudo eliminar el profesional.');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 text-slate-900 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-teal-100 p-3 text-teal-700">
              <UserPlus size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                {professional ? 'Editar Profesional' : 'Nuevo Profesional'}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Datos personales, matrículas y documentación respaldatoria.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNewProfessional && (
              <span className="rounded-full bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 ring-1 ring-slate-200">
                {uploadedDocuments.length} archivos
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-5 lg:grid-cols-[1.05fr_0.95fr] lg:p-7">
            <div className="space-y-6">
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-2 text-slate-600">
                    <IdCard size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Identidad y matrícula</h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Base profesional</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Nombre completo</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      placeholder="Ej: Lic. Juan Pérez"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Matrícula MN</label>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      placeholder="MN 1234"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Matrícula MP</label>
                    <input
                      type="text"
                      name="licenseNumberMP"
                      value={formData.licenseNumberMP}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      placeholder="MP 5678"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Especialidad</label>
                    <input
                      type="text"
                      name="specialty"
                      value={formData.specialty}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tipo principal</label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    >
                      <option value="MN">MN - Médico Nacional</option>
                      <option value="MP">MP - Médico Provincial</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
                    <BriefcaseMedical size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Contacto y antecedentes</h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Datos ampliados</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">DNI</label>
                    <input
                      type="text"
                      name="dni"
                      value={formData.dni}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Teléfono</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Fecha de nacimiento</label>
                    <input
                      type="date"
                      name="birthDate"
                      value={formData.birthDate}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Teléfono de emergencia</label>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Dirección</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Enfermedad o antecedente</label>
                    <textarea
                      name="medicalHistory"
                      value={formData.medicalHistory}
                      onChange={handleChange}
                      rows={5}
                      placeholder="Antecedentes médicos, restricciones o datos relevantes del profesional."
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Estado de agenda</h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Disponibilidad</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Activo</p>
                      <p className={`mt-1 text-sm font-black ${formData.isActive ? 'text-teal-600' : 'text-rose-500'}`}>
                        {formData.isActive ? 'Recibe turnos' : 'No disponible'}
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleChange}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-teal-600 peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  {!isNewProfessional && (
                    <div className="flex items-center justify-between rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">Archivado</p>
                        <p className={`mt-1 text-sm font-black ${formData.isArchived ? 'text-amber-700' : 'text-slate-500'}`}>
                          {formData.isArchived ? 'Oculto del staff activo' : 'Visible en sistema'}
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          name="isArchived"
                          checked={formData.isArchived}
                          onChange={handleChange}
                          className="peer sr-only"
                        />
                        <div className="h-6 w-11 rounded-full bg-amber-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-600 peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-violet-100 p-2 text-violet-700">
                    <BadgeCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Documentación</h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Abrir, descargar, quitar o actualizar</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {PROFESSIONAL_DOCUMENTS.map((document) => (
                    <DocumentUploadField
                      key={document.field}
                      label={document.label}
                      field={document.field}
                      value={formData[document.field]}
                      onUpload={handleUploadDocument}
                      onRemove={handleRemoveDocument}
                      uploading={uploadingField === document.field}
                      disabled={isNewProfessional}
                    />
                  ))}
                </div>

                {isNewProfessional && (
                  <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
                    Guarda primero la ficha del profesional. Después podrás cargar DNI, matrículas, título, registro y seguro.
                  </div>
                )}
              </section>
            </div>
          </div>

          {error && (
            <div className="mx-5 mb-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 lg:mx-7">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-5 sm:flex-row lg:px-7">
            {professional && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 py-3 font-black text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={18} />
                Eliminar profesional
              </button>
            )}

            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 font-black text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? 'Guardando...' : 'Guardar profesional'}
              </button>
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-black text-slate-800">¿Eliminar profesional?</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                Esta acción no se puede deshacer. Solo se podrá eliminar si no tiene turnos activos ni historias clínicas asociadas.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-black text-slate-500 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {saving ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalModal;
