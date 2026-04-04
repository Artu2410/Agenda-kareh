import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Activity,
  AlertCircle,
  Edit2,
  FileText,
  Loader2,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import { MedicalAlertTooltip } from '../components/Tooltip';
import { useConfirmModal } from '../hooks/useConfirmModal';
import DocumentUploadField from '../components/DocumentUploadField';
import { buildClinicalHistoryPath, persistClinicalHistoryContext } from '../utils/appRoutes';
import { getCoverageLabel, isParticularCoverage } from '../utils/coverage';

const UNKNOWN_BIRTHDATE = '1900-01-01';
const MAX_UPLOAD_MB = Number(import.meta.env.VITE_UPLOAD_MAX_MB || 25);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const EMPTY_FORM = {
  fullName: '',
  dni: '',
  phone: '',
  email: '',
  address: '',
  birthDate: '',
  healthInsurance: '',
  treatAsParticular: false,
  affiliateNumber: '',
  emergencyPhone: '',
  medicalHistory: '',
  hasCancer: false,
  hasMarcapasos: false,
  usesEA: false,
  medicalNotes: '',
  dniImageUrl: '',
  dniBackImageUrl: '',
  insuranceCardImageUrl: '',
  insuranceCardBackImageUrl: '',
};

const PATIENT_DOCUMENTS = [
  { field: 'dniImageUrl', label: 'DNI frente', tone: 'bg-slate-100 text-slate-600' },
  { field: 'dniBackImageUrl', label: 'DNI dorso', tone: 'bg-slate-100 text-slate-600' },
  { field: 'insuranceCardImageUrl', label: 'Credencial frente', tone: 'bg-teal-100 text-teal-700' },
  { field: 'insuranceCardBackImageUrl', label: 'Credencial dorso', tone: 'bg-teal-100 text-teal-700' },
];

const isUnknownBirthDate = (birthDate) => {
  if (!birthDate) return true;
  const dateString = birthDate.includes('T') ? birthDate.split('T')[0] : birthDate;
  return dateString <= UNKNOWN_BIRTHDATE;
};

const formatBirthDateForInput = (birthDate) => (
  birthDate && !isUnknownBirthDate(birthDate) ? birthDate.split('T')[0] : ''
);

const sortByLastName = (items) => [...items].sort((a, b) => {
  const nameA = String(a.fullName || '').split(' ').pop().toLowerCase();
  const nameB = String(b.fullName || '').split(' ').pop().toLowerCase();
  return nameA.localeCompare(nameB, 'es');
});

const renderPatientBadges = (patient) => (
  <div className="flex gap-1">
    {patient.hasCancer && <MedicalAlertTooltip icon={AlertCircle} alert="oncologico" />}
    {patient.hasMarcapasos && <MedicalAlertTooltip icon={Activity} alert="marcapasos" />}
    {patient.usesEA && <MedicalAlertTooltip icon={Zap} alert="ea" />}
  </div>
);

export default function PatientsPage() {
  const navigate = useNavigate();
  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/patients/all');
      setPatients(sortByLastName(response.data || []));
    } catch (error) {
      console.error('Error cargando pacientes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const filteredPatients = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return sortByLastName(patients);

    return sortByLastName(
      patients.filter((patient) => (
        patient.fullName?.toLowerCase().includes(normalizedTerm)
        || patient.dni?.includes(searchTerm)
        || patient.healthInsurance?.toLowerCase().includes(normalizedTerm)
        || getCoverageLabel(patient.healthInsurance, patient.treatAsParticular).toLowerCase().includes(normalizedTerm)
      ))
    );
  }, [patients, searchTerm]);

  const openCreateModal = () => {
    setIsNewPatient(true);
    setSelectedPatient(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (patient) => {
    setIsNewPatient(false);
    setSelectedPatient(patient);
    setFormData({
      ...EMPTY_FORM,
      ...patient,
      birthDate: formatBirthDateForInput(patient.birthDate),
      emergencyPhone: patient.emergencyPhone || '',
      medicalHistory: patient.medicalHistory || '',
      medicalNotes: patient.medicalNotes || '',
      dniImageUrl: patient.dniImageUrl || '',
      dniBackImageUrl: patient.dniBackImageUrl || '',
      insuranceCardImageUrl: patient.insuranceCardImageUrl || '',
      insuranceCardBackImageUrl: patient.insuranceCardBackImageUrl || '',
    });
    setShowModal(true);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const patchPatientField = async (field, value) => {
    if (!selectedPatient?.id) return;
    await api.patch(`/patients/${selectedPatient.id}`, { [field]: value });
    setFormData((prev) => ({ ...prev, [field]: value || '' }));
    setSelectedPatient((prev) => (prev ? { ...prev, [field]: value || '' } : prev));
  };

  const handleUploadDocument = async (field, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (isNewPatient || !selectedPatient?.id) {
      alert('Primero guarda el paciente para poder adjuntar documentación.');
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
      payload.append('patientId', selectedPatient.id);
      payload.append('scope', 'patient-documents');

      const response = await api.post('/uploads', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await patchPatientField(field, response.data?.url || '');
    } catch (error) {
      console.error('Error subiendo documento:', error);
      alert(error?.response?.data?.message || 'No se pudo subir el archivo.');
    } finally {
      setUploadingField('');
    }
  };

  const handleRemoveDocument = async (field) => {
    if (isNewPatient || !selectedPatient?.id) return;
    const confirmed = window.confirm('¿Quieres quitar este archivo de la ficha del paciente?');
    if (!confirmed) return;

    try {
      setUploadingField(field);
      await patchPatientField(field, null);
    } catch (error) {
      console.error('Error quitando documento:', error);
      alert(error?.response?.data?.message || 'No se pudo quitar el archivo.');
    } finally {
      setUploadingField('');
    }
  };

  const savePatient = async (event) => {
    event.preventDefault();

    try {
      setSavingPatient(true);
      if (isNewPatient) {
        await api.post('/patients', formData);
      } else {
        await api.put(`/patients/${selectedPatient.id}`, formData);
      }
      await fetchPatients();
      setShowModal(false);
    } catch (error) {
      alert(`Error al guardar: ${error.response?.data?.message || error.message}`);
    } finally {
      setSavingPatient(false);
    }
  };

  const deletePatient = (id) => {
    openModal({
      title: 'Eliminar paciente',
      message: 'Esta acción quitará el paciente de la base clínica. ¿Deseas continuar?',
      confirmText: 'Eliminar',
      danger: true,
      icon: Trash2,
      onConfirm: async () => {
        try {
          await api.delete(`/patients/${id}`);
          setPatients((prev) => prev.filter((item) => item.id !== id));
        } catch {
          alert('Error al eliminar');
        }
      },
    });
  };

  const openClinicalHistory = (patient) => {
    persistClinicalHistoryContext({ patientId: patient.id, patientName: patient.fullName });
    navigate(buildClinicalHistoryPath(patient.fullName), {
      state: {
        patientId: patient.id,
        patientName: patient.fullName,
      },
    });
  };

  const renderPatientDocuments = (patient) => {
    const documents = PATIENT_DOCUMENTS.filter((document) => patient[document.field]);

    if (!documents.length) {
      return <span className="text-xs font-semibold text-slate-400">Sin archivos</span>;
    }

    return documents.map((document) => (
      <a
        key={document.field}
        href={patient[document.field]}
        target="_blank"
        rel="noreferrer"
        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${document.tone}`}
      >
        {document.label}
      </a>
    ));
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-slate-600">Gestión clínica, contacto y documentación respaldatoria.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="w-full rounded-xl bg-teal-600 px-6 py-3 font-medium text-white sm:w-auto sm:py-2"
        >
          + Nuevo Paciente
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-3 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por nombre, DNI u obra social..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-xl border py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-white shadow-sm lg:block">
            <table className="w-full text-left">
              <thead className="border-b bg-slate-50 text-xs font-bold uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">Alertas</th>
                  <th className="px-6 py-4">DNI</th>
                  <th className="px-6 py-4">Obra Social</th>
                  <th className="px-6 py-4">Documentos</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-800">{patient.fullName}</td>
                    <td className="px-6 py-4">{renderPatientBadges(patient)}</td>
                    <td className="px-6 py-4 text-slate-600">{patient.dni}</td>
                    <td className={`px-6 py-4 font-bold uppercase ${isParticularCoverage(patient.healthInsurance, patient.treatAsParticular) ? 'text-blue-700' : 'text-slate-600'}`}>
                      {getCoverageLabel(patient.healthInsurance, patient.treatAsParticular)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {renderPatientDocuments(patient)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => openClinicalHistory(patient)} className="p-2 hover:text-teal-600">
                          <FileText size={18} />
                        </button>
                        <button type="button" onClick={() => openEditModal(patient)} className="p-2 hover:text-blue-600">
                          <Edit2 size={18} />
                        </button>
                        <button type="button" onClick={() => deletePatient(patient.id)} className="p-2 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 lg:hidden">
            {filteredPatients.map((patient) => (
              <article key={patient.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-slate-800">{patient.fullName}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">DNI: {patient.dni}</p>
                    <p className={`text-sm font-bold uppercase ${isParticularCoverage(patient.healthInsurance, patient.treatAsParticular) ? 'text-blue-700' : 'text-slate-500'}`}>
                      {getCoverageLabel(patient.healthInsurance, patient.treatAsParticular)}
                    </p>
                  </div>
                  {renderPatientBadges(patient)}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {renderPatientDocuments(patient)}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => openClinicalHistory(patient)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase text-teal-600">
                    Historia
                  </button>
                  <button type="button" onClick={() => openEditModal(patient)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase text-blue-600">
                    Editar
                  </button>
                  <button type="button" onClick={() => deletePatient(patient.id)} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-600">
                    Borrar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={savePatient}
            className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-xl sm:p-7"
          >
            <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-slate-800">{isNewPatient ? 'Nuevo Paciente' : 'Editar Paciente'}</h2>
                <p className="text-sm text-slate-500">Ficha clínica organizada con contacto, alertas y documentos.</p>
              </div>
              {!isNewPatient && (
                <p className="w-fit rounded-full bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                  ficha activa
                </p>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-6">
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-black text-slate-800">Datos personales</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Identidad y contacto</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Nombre completo</label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">DNI</label>
                      <input
                        type="text"
                        name="dni"
                        value={formData.dni}
                        onChange={handleInputChange}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Teléfono</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email || ''}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Fecha de nacimiento</label>
                      <input
                        type="date"
                        name="birthDate"
                        value={formData.birthDate}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Dirección</label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address || ''}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-black text-slate-800">Cobertura y antecedentes</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Información clínica y administrativa</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Obra social</label>
                      <input
                        type="text"
                        name="healthInsurance"
                        value={formData.healthInsurance}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Número de afiliado</label>
                      <input
                        type="text"
                        name="affiliateNumber"
                        value={formData.affiliateNumber || ''}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tratamiento particular</div>
                          <div className="text-sm font-semibold text-slate-500">
                            {formData.treatAsParticular
                              ? `Se mostrará como ${getCoverageLabel(formData.healthInsurance, true)}`
                              : 'Usa la cobertura cargada'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, treatAsParticular: !prev.treatAsParticular }))}
                          className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                            formData.treatAsParticular
                              ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                              : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-700'
                          }`}
                        >
                          {formData.treatAsParticular ? 'Activo' : 'Desactivado'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Teléfono de emergencia</label>
                      <input
                        type="tel"
                        name="emergencyPhone"
                        value={formData.emergencyPhone || ''}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Enfermedad o antecedente</label>
                      <input
                        type="text"
                        name="medicalHistory"
                        value={formData.medicalHistory || ''}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-black text-slate-800">Alertas y notas</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Seguimiento rápido</p>

                  <div className="mt-4 rounded-3xl bg-red-50 p-4">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-red-400">Alertas médicas</p>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name="hasCancer" checked={formData.hasCancer} onChange={handleInputChange} />
                        Oncológico
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name="hasMarcapasos" checked={formData.hasMarcapasos} onChange={handleInputChange} />
                        Marcapasos
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name="usesEA" checked={formData.usesEA} onChange={handleInputChange} />
                        Usa EA
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Notas clínicas</label>
                    <textarea
                      name="medicalNotes"
                      value={formData.medicalNotes || ''}
                      onChange={handleInputChange}
                      rows={5}
                      placeholder="Alergias, observaciones o indicaciones administrativas."
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:ring-2 ring-teal-500"
                    />
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-black text-slate-800">Documentación del paciente</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Abrir, descargar, quitar o actualizar</p>

                  <div className="mt-4 space-y-4">
                    {PATIENT_DOCUMENTS.map((document) => (
                      <DocumentUploadField
                        key={document.field}
                        label={document.label}
                        field={document.field}
                        value={formData[document.field]}
                        onUpload={handleUploadDocument}
                        onRemove={handleRemoveDocument}
                        uploading={uploadingField === document.field}
                        disabled={isNewPatient}
                      />
                    ))}
                  </div>

                  {isNewPatient && (
                    <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      Guarda primero la ficha para habilitar la subida y actualización de documentos.
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 p-3 font-black text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingPatient}
                className="flex-1 rounded-2xl bg-teal-600 p-3 font-black text-white"
              >
                {savingPatient ? 'Guardando...' : 'Guardar paciente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {ConfirmModalComponent}
    </div>
  );
}
