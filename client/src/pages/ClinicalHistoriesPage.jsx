import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, ChevronRight } from 'lucide-react';
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
      const response = await api.get('/patients/all');
      const sorted = response.data.sort((a, b) => {
        const nameA = a.fullName.toLowerCase();
        const nameB = b.fullName.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setPatients(sorted);
      setError(null);
    } catch (err) {
      console.error('Error al cargar pacientes:', err);
      setError('No se pudieron cargar los pacientes');
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    if (!searchTerm.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = patients.filter(patient => {
      const fullName = patient.fullName.toLowerCase();
      const dni = patient.dni.toLowerCase();
      return fullName.includes(searchLower) || dni.includes(searchLower);
    });

    setFilteredPatients(filtered);
  };

  const handleViewHistory = (patientId) => {
    navigate(`/clinical-history/${patientId}`);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText size={32} className="text-teal-600" />
            <h1 className="text-4xl font-bold text-slate-900">Historia Clínica</h1>
          </div>
          <p className="text-slate-600">Selecciona un paciente para ver su historia clínica</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error}
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-slate-600">
              {searchTerm
                ? 'No se encontraron pacientes que coincidan con tu búsqueda'
                : 'No hay pacientes registrados'}
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-6 text-sm text-slate-600">
              Mostrando <span className="font-semibold">{filteredPatients.length}</span> de{' '}
              <span className="font-semibold">{patients.length}</span> pacientes
            </div>

            {/* Patients List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => handleViewHistory(patient.id)}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border border-slate-200 hover:border-teal-400 hover:bg-teal-50 group"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                          {patient.fullName}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">DNI: {patient.dni}</p>
                      </div>
                      <ChevronRight className="text-slate-300 group-hover:text-teal-600 transition-colors" size={24} />
                    </div>

                    {/* Patient Info */}
                    <div className="space-y-2 text-sm">
                      {patient.phone && (
                        <p className="text-slate-600">
                          <span className="font-semibold">Tel:</span> {patient.phone}
                        </p>
                      )}
                      {patient.address && (
                        <p className="text-slate-600">
                          <span className="font-semibold">Dir:</span> {patient.address}
                        </p>
                      )}
                    </div>

                    {/* Appointments Count */}
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <span className="inline-block bg-teal-100 text-teal-800 rounded-full px-3 py-1 text-xs font-semibold">
                        {patient._count?.appointments || 0} cita{patient._count?.appointments !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
