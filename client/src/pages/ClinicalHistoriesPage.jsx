import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ChevronLeft, User, FileText, Loader2, Phone, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClinicalHistoryPage() {
  const { id } = useParams(); // Esto captura el ID de la URL
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setLoading(true);
        // Usamos el ID de la URL para pedir los datos al backend
        const response = await api.get(`/patients/${id}`);
        setPatient(response.data);
      } catch (err) {
        console.error('Error al cargar paciente:', err);
        toast.error('No se pudo encontrar al paciente');
        navigate('/clinical-histories');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPatientData();
  }, [id, navigate]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  );

  if (!patient) return null;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-8">
      {/* Botón para volver que tanto necesitabas */}
      <button 
        onClick={() => navigate('/clinical-histories')} 
        className="flex items-center gap-2 text-slate-400 hover:text-teal-600 font-bold uppercase text-[10px] tracking-widest mb-8 transition-colors"
      >
        <ChevronLeft size={16} /> Volver a Historias Clínicas
      </button>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Card con los datos de Jose Azocar */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 bg-teal-50 rounded-[2rem] flex items-center justify-center text-teal-600 border border-teal-100">
              <User size={48} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-2">
                {patient.fullName}
              </h1>
              <div className="flex gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">DNI: {patient.dni}</span>
                <span className="text-xs font-bold text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded">
                  {patient.healthInsurance || 'Particular'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mt-10 pt-10 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-slate-300" />
              <span className="font-bold text-slate-700">{patient.phone || 'Sin teléfono'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-slate-300" />
              <span className="font-bold text-slate-700 uppercase">Citas: {patient._count?.appointments || 0}</span>
            </div>
          </div>
        </div>

        {/* Sección de Evoluciones */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200 min-h-[300px]">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3 mb-8">
            <FileText className="text-teal-500" /> Evolución Clínica
          </h2>
          <div className="flex flex-col items-center justify-center py-20 opacity-20 border-2 border-dashed border-slate-50 rounded-3xl">
            <FileText size={48} />
            <p className="font-bold uppercase text-[10px] mt-4">No hay registros aún</p>
          </div>
        </div>
      </div>
    </div>
  );
}