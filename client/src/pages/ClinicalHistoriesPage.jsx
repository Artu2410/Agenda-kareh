import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ChevronLeft, User, FileText, Loader2, Phone, Calendar, Heart } from 'lucide-react';
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
        toast.error("Error al cargar la ficha del paciente");
        navigate('/clinical-histories');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPatientData();
  }, [id, navigate]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-teal-600">
      <Loader2 className="animate-spin" size={48} />
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-8">
      {/* Botón Volver con tu estilo */}
      <button 
        onClick={() => navigate('/clinical-histories')} 
        className="flex items-center gap-2 text-slate-400 hover:text-teal-600 font-bold uppercase text-xs tracking-widest mb-8 transition-all"
      >
        <ChevronLeft size={20} /> Volver a Historias Clínicas
      </button>

      <div className="max-w-5xl mx-auto">
        {/* Card Principal del Paciente */}
        <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-200 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex items-center gap-8">
              <div className="w-24 h-24 bg-teal-50 rounded-3xl flex items-center justify-center text-teal-600 border border-teal-100 shadow-sm">
                <User size={48} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-2">
                  {patient.fullName}
                </h1>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    DNI: {patient.dni}
                  </span>
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {patient.healthInsurance || 'Particular'}
                  </span>
                </div>
              </div>
            </div>

            {/* Alertas Médicas que tenías */}
            <div className="flex gap-2">
              {patient.hasCancer && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-2xl border border-red-100 font-bold text-[10px] uppercase">
                  <Heart size={14} fill="currentColor" /> Oncológico
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-10 border-t border-slate-50">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono de Contacto</p>
              <p className="text-lg font-bold text-slate-700 flex items-center gap-2"><Phone size={16} className="text-teal-500" /> {patient.phone || 'No registrado'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha de Nacimiento</p>
              <p className="text-lg font-bold text-slate-700 flex items-center gap-2"><Calendar size={16} className="text-teal-500" /> {patient.birthDate || 'No registrada'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Sesiones</p>
              <p className="text-lg font-bold text-slate-700 flex items-center gap-2"><FileText size={16} className="text-teal-500" /> {patient._count?.appointments || 0} Sesiones</p>
            </div>
          </div>
        </div>

        {/* Sección Evolución */}
        <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-200 min-h-[400px]">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-4 mb-10">
            <div className="p-2 bg-teal-500 rounded-xl text-white"><FileText size={24} /></div>
            Evolución Clínica
          </h2>
          
          <div className="flex flex-col items-center justify-center py-24 text-slate-300 border-2 border-dashed border-slate-50 rounded-[2rem]">
            <FileText size={64} className="mb-4 opacity-20" />
            <p className="font-bold uppercase text-xs tracking-widest opacity-30">No hay registros de evolución aún</p>
          </div>
        </div>
      </div>
    </div>
  );
}