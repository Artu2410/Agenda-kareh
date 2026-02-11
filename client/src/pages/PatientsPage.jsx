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
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '', dni: '', phone: '', email: '', address: '', birthDate: '', 
    healthInsurance: '', hasCancer: false, hasMarcapasos: false, usesEA: false
  });

  useEffect(() => { fetchPatients(); }, []);
  useEffect(() => { filterPatients(); }, [searchTerm, patients]);

  const sortByLastName = (arr) => [...arr].sort((a, b) => {
    const nameA = a.fullName.split(' ').pop().toLowerCase();
    const nameB = b.fullName.split(' ').pop().toLowerCase();
    return nameA.localeCompare(nameB, 'es');
  });

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/patients/all');
      setPatients(sortByLastName(response.data));
    } catch (err) {
      console.error('Error:', err);
    } finally { setLoading(false); }
  };

  const filterPatients = () => {
    const filtered = patients.filter(p => 
      p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || p.dni.includes(searchTerm)
    );
    setFilteredPatients(sortByLastName(filtered));
  };

  const openEditModal = (patient) => {
    setIsNewPatient(false);
    setSelectedPatient(patient);
    setFormData({
      ...patient,
      birthDate: patient.birthDate ? patient.birthDate.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const savePatient = async (e) => {
    e.preventDefault();
    try {
      setSavingPatient(true);
      if (isNewPatient) {
        await api.post('/patients', formData);
      } else {
        // CAMBIO CRÍTICO: Usamos PUT para disparar la normalización del backend
        await api.put(`/patients/${selectedPatient.id}`, formData);
      }
      fetchPatients();
      setShowModal(false);
    } catch (err) {
      alert('Error al guardar: ' + (err.response?.data?.message || err.message));
    } finally { setSavingPatient(false); }
  };

  const deletePatient = async (id) => {
    if (!window.confirm('¿Eliminar paciente?')) return;
    try {
      await api.delete(`/patients/${id}`);
      setPatients(p => p.filter(item => item.id !== id));
    } catch (err) { alert('Error al eliminar'); }
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-slate-600">Gestión de base de datos clínica</p>
        </div>
        <button onClick={() => { setIsNewPatient(true); setFormData({fullName:'', dni:'', phone:'', email:'', address:'', birthDate:'', healthInsurance:'', hasCancer:false, hasMarcapasos:false, usesEA:false}); setShowModal(true); }} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium">+ Nuevo Paciente</button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-3 text-slate-400" size={20} />
        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500" />
      </div>

      {loading ? <div className="animate-spin h-10 w-10 border-b-2 border-teal-500 mx-auto" /> : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-xs font-bold text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Alertas</th>
                <th className="px-6 py-4">DNI</th>
                <th className="px-6 py-4">Obra Social</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredPatients.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold text-slate-800">{p.fullName}</td>
                  <td className="px-6 py-4 flex gap-1">
                    {p.hasCancer && <MedicalAlertTooltip icon={AlertCircle} alert="oncologico" />}
                    {p.hasMarcapasos && <MedicalAlertTooltip icon={Activity} alert="marcapasos" />}
                    {p.usesEA && <MedicalAlertTooltip icon={Zap} alert="ea" />}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{p.dni}</td>
                  <td className="px-6 py-4 text-slate-600">{p.healthInsurance || '-'}</td>
                  <td className="px-6 py-4 flex gap-2 justify-center">
                    <button onClick={() => navigate(`/clinical-history/${p.id}`)} className="p-2 hover:text-teal-600"><FileText size={18} /></button>
                    <button onClick={() => openEditModal(p)} className="p-2 hover:text-blue-600"><Edit2 size={18} /></button>
                    <button onClick={() => deletePatient(p.id)} className="p-2 hover:text-red-600"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={savePatient} className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold border-b pb-4">{isNewPatient ? 'Nuevo Paciente' : 'Editar Paciente'}</h2>
            <div className="space-y-3">
              <input type="text" name="fullName" placeholder="Nombre completo" value={formData.fullName} onChange={handleInputChange} required className="w-full p-2 border rounded-lg" />
              <input type="text" name="dni" placeholder="DNI" value={formData.dni} onChange={handleInputChange} required className="w-full p-2 border rounded-lg" />
              <input type="text" name="healthInsurance" placeholder="Obra Social" value={formData.healthInsurance} onChange={handleInputChange} className="w-full p-2 border rounded-lg" />
              
              <div className="p-3 bg-red-50 rounded-lg space-y-2">
                <p className="text-[10px] font-bold text-red-400 uppercase">Alertas Médicas</p>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hasCancer" checked={formData.hasCancer} onChange={handleInputChange} /> Oncológico</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hasMarcapasos" checked={formData.hasMarcapasos} onChange={handleInputChange} /> Marcapasos</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="usesEA" checked={formData.usesEA} onChange={handleInputChange} /> Usa EA</label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input type="tel" name="phone" placeholder="Teléfono" value={formData.phone} onChange={handleInputChange} className="p-2 border rounded-lg" />
                <input type="date" name="birthDate" value={formData.birthDate} onChange={handleInputChange} className="p-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 p-2 border rounded-lg">Cancelar</button>
              <button type="submit" disabled={savingPatient} className="flex-1 p-2 bg-teal-600 text-white rounded-lg font-bold">{savingPatient ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}