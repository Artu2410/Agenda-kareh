import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, ChevronRight, Loader2 } from 'lucide-react';
import api from '../services/api';
import { buildClinicalHistoryPath, persistClinicalHistoryContext } from '../utils/appRoutes';
import { getCoverageLabel, isParticularCoverage } from '../utils/coverage';

const formatClinicalRecordNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) return 'Pendiente';
  return `HC ${String(numericValue).padStart(4, '0')}`;
};

export default function ClinicalHistoriesPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      // RUTA CORRECTA: /patients/all
      const response = await api.get('/patients/all');
      const data = Array.isArray(response.data) ? response.data : [];
      const sorted = data.sort((a, b) => {
        const nameA = a.fullName?.toLowerCase() || '';
        const nameB = b.fullName?.toLowerCase() || '';
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
  }, []);

  const filterPatients = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = patients.filter(patient => {
      const fullName = patient.fullName?.toLowerCase() || '';
      const dni = patient.dni?.toLowerCase() || '';
      return fullName.includes(searchLower) || dni.includes(searchLower);
    });

    setFilteredPatients(filtered);
  }, [patients, searchTerm]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    filterPatients();
  }, [filterPatients]);

  const handleViewHistory = (patient) => {
    persistClinicalHistoryContext({ patientId: patient.id, patientName: patient.fullName });
    navigate(buildClinicalHistoryPath(patient.fullName), {
      state: {
        patientId: patient.id,
        patientName: patient.fullName,
      },
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-4 sm:p-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <FileText size={32} className="text-teal-600" />
            <h1 className="text-4xl font-bold text-slate-900">Historia Clínica</h1>
          </div>
          <p className="text-slate-600">Cada paciente conserva un único número de historia clínica, aunque tenga múltiples evoluciones.</p>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-teal-500" size={40} />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 italic">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => handleViewHistory(patient)}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-teal-400 hover:bg-teal-50 hover:shadow-md sm:p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                      {formatClinicalRecordNumber(patient.clinicalRecordNumber)}
                    </p>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 uppercase">
                      {patient.fullName}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 font-mono">DNI: {patient.dni}</p>
                  </div>
                  <ChevronRight className="text-slate-300 group-hover:text-teal-600 transition-colors" size={24} />
                </div>
                <div className="space-y-1 text-xs text-slate-500 font-bold uppercase">
                   <p>Tel: {patient.phone || '---'}</p>
                   <p className={isParticularCoverage(patient.healthInsurance, patient.treatAsParticular) ? 'text-blue-700' : ''}>
                     OS: {getCoverageLabel(patient.healthInsurance, patient.treatAsParticular)}
                   </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
