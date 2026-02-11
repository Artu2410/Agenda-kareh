import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Search, User, ChevronRight, Loader2 } from 'lucide-react';

export default function ClinicalHistoriesPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        // Ajustado a la ruta que funciona en tu backend
        const res = await api.get('/patients/all');
        setPatients(res.data);
      } catch (err) {
        console.error("Error cargando pacientes:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, []);

  const filteredPatients = patients.filter(p => 
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.dni.includes(searchTerm)
  );

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-slate-800 uppercase mb-8 italic">Historias Clínicas</h1>
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nombre o DNI..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-teal-500 outline-none"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid gap-4">
          {filteredPatients.map(patient => (
            <div 
              key={patient.id}
              onClick={() => navigate(`/clinical-history/${patient.id}`)}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:border-teal-500 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 font-bold uppercase">
                  {patient.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 uppercase">{patient.fullName}</h3>
                  <p className="text-xs text-slate-400 font-medium">DNI: {patient.dni}</p>
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-teal-500 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}