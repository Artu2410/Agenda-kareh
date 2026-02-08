import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Search, Edit2, Trash2, X, FileText, Activity, Zap, AlertCircle } from 'lucide-react';
import { MedicalAlertTooltip } from '../components/Tooltip';

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  
  // ✅ Estado inicial con Alertas Médicas y Obra Social
  const [formData, setFormData] = useState({
    fullName: '',
    dni: '',
    phone: '',
    email: '',
    address: '',
    birthDate: '',
    healthInsurance: '',
    hasCancer: false,
    hasMarcapasos: false,
    usesEA: false
  });
  
  const [savingPatient, setSavingPatient] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    filterPatients();
  }, [searchTerm, patients]);

  // 📌 Función para ordenar por apellido (A-Z)
  const sortByLastName = (patientsArray) => {
    return [...patientsArray].sort((a, b) => {
      const apellidoA = a.fullName.split(' ').pop().toLowerCase().trim();
      const apellidoB = b.fullName.split(' ').pop().toLowerCase().trim();
      return apellidoA.localeCompare(apellidoB, 'es');
    });
  };

  // 📌 Función para invertir nombre: "jose azocar" → "Azocar Jose"
  const formatFullName = (fullName) => {
    const parts = fullName.trim().split(' ');
    if (parts.length < 2) return fullName; // Si solo tiene un nombre, devolver como está
    
    const apellido = parts.pop(); // Último elemento es apellido
    const nombres = parts.join(' '); // Resto son nombres
    
    return `${apellido.charAt(0).toUpperCase() + apellido.slice(1).toLowerCase()} ${nombres.charAt(0).toUpperCase() + nombres.slice(1).toLowerCase()}`;
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/patients/all');
      // Ordenar por apellido (A-Z)
      const sorted = sortByLastName(response.data);
      setPatients(sorted);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los pacientes');
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    if (!searchTerm.trim()) {
      // Asegurar que siempre están ordenados
      const sorted = sortByLastName(patients);
      setFilteredPatients(sorted);
      return;
    }
    const searchLower = searchTerm.toLowerCase();
    const filtered = patients.filter(patient => 
      patient.fullName.toLowerCase().includes(searchLower) || patient.dni.toLowerCase().includes(searchLower)
    );
    // Mantener el orden A-Z incluso después de filtrar
    const sorted = sortByLastName(filtered);
    setFilteredPatients(sorted);
  };

  // ✅ Abrir Modal para Editar con carga de alertas y obra social
  const openEditModal = (patient) => {
    setIsNewPatient(false);
    setSelectedPatient(patient);
    setFormData({
      fullName: patient.fullName,
      dni: patient.dni,
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      birthDate: patient.birthDate ? patient.birthDate.split('T')[0] : '',
      healthInsurance: patient.healthInsurance || '',
      hasCancer: patient.hasCancer || false,
      hasMarcapasos: patient.hasMarcapasos || false,
      usesEA: patient.usesEA || false,
    });
    setShowModal(true);
  };

  const openNewPatientModal = () => {
    setIsNewPatient(true);
    setSelectedPatient(null);
    setFormData({
      fullName: '', dni: '', phone: '', email: '', address: '', birthDate: '', healthInsurance: '',
      hasCancer: false, hasMarcapasos: false, usesEA: false
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPatient(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const savePatient = async (e) => {
    e.preventDefault();
    try {
      setSavingPatient(true);
      if (isNewPatient) {
        const response = await api.post('/patients', formData);
        setPatients([...patients, response.data]);
      } else {
        await api.patch(`/patients/${selectedPatient.id}`, formData);
        const updated = patients.map(p => p.id === selectedPatient.id ? { ...p, ...formData } : p);
        setPatients(updated);
      }
      closeModal();
      alert(isNewPatient ? 'Paciente creado' : 'Paciente actualizado');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingPatient(false);
    }
  };

  const deletePatient = async (patientId) => {
    if (window.confirm('¿Eliminar este paciente?')) {
      try {
        setDeletingPatient(true);
        await api.delete(`/patients/${patientId}`);
        setPatients(patients.filter(p => p.id !== patientId));
      } catch (err) {
        alert('Error al eliminar');
      } finally {
        setDeletingPatient(false);
      }
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Pacientes</h1>
          <p className="text-slate-600">Gestión de base de datos clínica</p>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <button onClick={openNewPatientModal} className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center gap-2">
            + Nuevo Paciente
          </button>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-4 top-3 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Paciente</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Alertas</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">DNI</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Obra Social</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Contacto</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{formatFullName(patient.fullName)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                          {patient.hasCancer && <MedicalAlertTooltip icon={AlertCircle} alert="oncologico" message="Paciente con historia oncológica" />}
                          {patient.hasMarcapasos && <MedicalAlertTooltip icon={Activity} alert="marcapasos" message="Paciente con marcapasos" />}
                          {patient.usesEA && <MedicalAlertTooltip icon={Zap} alert="ea" message="Paciente usa estimulación auditiva" />}
                        {!patient.hasCancer && !patient.hasMarcapasos && !patient.usesEA && <span className="text-slate-300 text-xs">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{patient.dni}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{patient.healthInsurance || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{patient.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => navigate(`/clinical-history/${patient.id}`)} className="p-2 text-slate-400 hover:text-teal-600"><FileText size={18} /></button>
                        <button onClick={() => openEditModal(patient)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={18} /></button>
                        <button onClick={() => deletePatient(patient.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edición/Creación */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-slate-900">{isNewPatient ? 'Nuevo Paciente' : 'Editar Paciente'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <form onSubmit={savePatient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Nombre Completo *</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} required className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">DNI *</label>
                  <input type="text" name="dni" value={formData.dni} onChange={handleInputChange} required className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Obra Social</label>
                  <input type="text" name="healthInsurance" value={formData.healthInsurance} onChange={handleInputChange} placeholder="Ej: IOMA, PAMI, Particular..." className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                
                {/* ✅ SECCIÓN DE ALERTAS MÉDICAS */}
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 space-y-3">
                  <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest">Alertas de Seguridad</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="hasCancer" checked={formData.hasCancer} onChange={handleInputChange} className="w-4 h-4 text-red-600 rounded" />
                      <span className="text-sm font-semibold text-slate-700">Paciente Oncológico</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="hasMarcapasos" checked={formData.hasMarcapasos} onChange={handleInputChange} className="w-4 h-4 text-blue-600 rounded" />
                      <span className="text-sm font-semibold text-slate-700">Usa Marcapasos</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="usesEA" checked={formData.usesEA} onChange={handleInputChange} className="w-4 h-4 text-amber-600 rounded" />
                      <span className="text-sm font-semibold text-slate-700">Usa EA (Electrodos/Otros)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Teléfono</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">F. Nacimiento</label>
                    <input type="date" name="birthDate" value={formData.birthDate} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Dirección</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl outline-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-3 border rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={savingPatient} className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50">
                  {savingPatient ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}