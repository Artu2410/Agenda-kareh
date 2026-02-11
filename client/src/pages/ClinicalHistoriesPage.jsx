import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, ChevronRight, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function ClinicalHistoriesPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    filterPatients();
  }, [searchTerm, patients]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      // CAMBIO CLAVE: Usamos la ruta correcta que el backend reconoce
      const response = await api.get('/patients/all');
      
      // Ordenamos por apellido (asumiendo que el apellido está al final o es parte del fullName)
      const sorted = response.data.sort((a, b) => 
        a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' })
      );
      
      setPatients(sorted);
      setError(null);
    } catch (err) {
      console.error('Error al cargar pacientes:', err);
      // Usamos el mensaje amigable de tu interceptor si existe
      setError(err.friendlyMessage || 'No se pudieron cargar los pacientes. Verifica la conexión.');
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) {
      setFilteredPatients(patients);
      return;
    }

    const filtered = patients.filter(patient => 
      patient.fullName.toLowerCase().includes(searchLower) || 
      patient.dni.includes(searchLower)
    );

    setFilteredPatients(filtered);
  };

  // Esta función debe coincidir con la ruta en tu App.jsx
  const handleViewHistory = (patientId) => {
    navigate(`/clinical-history/${patientId}`);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-teal-100 rounded-2xl text-teal-600">
              <FileText size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Historias Clínicas</h1>
              <p className="text-slate-500 font-medium">Selecciona un paciente para ver su ficha técnica</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={22} />
            <input
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-lg"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-4">
            <Loader2 className="animate-spin text-teal-500" size={40} />
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Cargando base de datos...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-800 flex items-center gap-4">
            <div className="bg-red-100 p-2 rounded-full">⚠️</div>
            <p className="font-bold">{error}</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
            <p className="text-slate-400 font-bold uppercase tracking-widest">
              {searchTerm ? 'Sin coincidencias' : 'No hay pacientes registrados'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => handleViewHistory(patient.id)}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-teal-500 hover:shadow-xl hover:shadow-teal-900/5 transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 group-hover:text-teal-600 transition-colors uppercase leading-tight">
                      {patient.fullName}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">DNI: {patient.dni}</p>
                  </div>
                  <ChevronRight className="text-slate-300 group-hover:text-teal-500 transition-all group-hover:translate-x-1" size={24} />
                </div>

                <div className="space-y-1 mb-6">
                   <p className="text-sm text-slate-600 font-medium">{patient.healthInsurance || 'Sin Obra Social'}</p>
                   <p className="text-xs text-slate-400">{patient.phone || 'Sin teléfono'}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
                    {patient._count?.appointments || 0} Sesiones
                  </span>
                  {patient.hasCancer && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}