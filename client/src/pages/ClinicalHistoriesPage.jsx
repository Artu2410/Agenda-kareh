import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ChevronLeft, User, FileText, Loader2, Phone, Calendar, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClinicalHistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/patients/${id}`);
        setPatient(response.data);
      } catch (err) {
        console.error('Error:', err);
        toast.error('No se pudo cargar la historia clínica');
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

  if (!patient) return <div className="p-8 text-center font-bold text-slate-500 uppercase">Paciente no encontrado</div>;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-8">
      <button 
        onClick={() => navigate('/clinical-histories')} 
        className="flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] tracking-widest mb-8 transition-colors"
      >
        <ChevronLeft size={16} /> Volver a la lista
      </button>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabecera Principal */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 bg-teal-50 rounded-[2rem] flex items-center justify-center text-teal-600 border border-teal-100 shadow-inner">
              <User size={48} />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-2">
                {patient.fullName}
              </h1>
              <div className="flex flex-wrap gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">DNI: {patient.dni}</span>
                <span className="text-xs font-black text-teal-600 uppercase tracking-widest bg-teal-50 px-3 py-0.5 rounded-full">
                  {patient.healthInsurance || 'Particular'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 pt-10 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Phone size={18} /></div>
              <span className="font-bold text-slate-700 text-sm">{patient.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><MapPin size={18} /></div>
              <span className="font-bold text-slate-700 text-sm">{patient.address || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Calendar size={18} /></div>
              <span className="font-bold text-slate-700 text-sm uppercase">Sesiones: {patient._count?.appointments || 0}</span>
            </div>
          </div>
        </div>

        {/* Sección de Evoluciones */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200 min-h-[400px]">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
              <FileText className="text-teal-500" /> Evolución Clínica
            </h2>
          </div>
          
          <div className="flex flex-col items-center justify-center py-20 opacity-20 border-2 border-dashed border-slate-100 rounded-3xl">
            <FileText size={64} className="text-slate-300" />
            <p className="font-black uppercase text-[10px] tracking-[0.2em] mt-6 text-slate-400">Sin registros históricos</p>
          </div>
        </div>
      </div>
    </div>
  );
}