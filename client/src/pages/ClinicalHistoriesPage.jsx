import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api'; // Verifica que la ruta sea correcta
import { ChevronLeft, User, ClipboardList, HeartPulse, AlertTriangle, Loader2 } from 'lucide-react';

export default function ClinicalHistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Traemos datos del paciente
        const resPatient = await api.get(`/patients/${id}`);
        setPatient(resPatient.data);
        // Traemos su historial (igual que en tu Modal)
        const resHistory = await api.get(`/patients/${id}/history`);
        setHistory(resHistory.data);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-teal-600" size={40} /></div>;
  if (!patient) return <div className="p-10 text-center uppercase font-bold text-slate-400">Paciente no encontrado</div>;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-4 sm:p-8">
      <button onClick={() => navigate('/clinical-histories')} className="flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] tracking-widest mb-6">
        <ChevronLeft size={16} /> Volver a Historias
      </button>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA: DATOS Y ANTECEDENTES */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 bg-teal-50 rounded-3xl flex items-center justify-center text-teal-600 mb-4">
                <User size={40} />
              </div>
              <h1 className="text-2xl font-black text-slate-800 uppercase leading-tight">{patient.fullName}</h1>
              <p className="text-xs font-bold text-slate-400 mt-2">DNI: {patient.dni}</p>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-3 text-slate-600">
                <div className="p-2 bg-slate-50 rounded-lg"><HeartPulse size={16}/></div>
                <span className="text-sm font-bold">{patient.healthInsurance || 'Particular'}</span>
              </div>
            </div>
          </div>

          {/* ANTECEDENTES (Copiado de tu lógica de Modal) */}
          <div className="bg-amber-50 rounded-[2rem] p-8 border border-amber-100">
            <h3 className="text-amber-700 font-black uppercase text-[10px] tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle size={14} /> Antecedentes Médicos
            </h3>
            <div className="space-y-3">
              {patient.hasCancer && <div className="bg-white/50 p-3 rounded-xl text-rose-600 text-xs font-bold uppercase border border-rose-100">Oncológico</div>}
              {patient.hasMarcapasos && <div className="bg-white/50 p-3 rounded-xl text-amber-600 text-xs font-bold uppercase border border-amber-100">Marcapasos</div>}
              {patient.usesEA && <div className="bg-white/50 p-3 rounded-xl text-blue-600 text-xs font-bold uppercase border border-blue-100">Electroanalgesia</div>}
              {!patient.hasCancer && !patient.hasMarcapasos && !patient.usesEA && <p className="text-xs text-amber-600/50 font-bold italic text-center">Sin antecedentes registrados</p>}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: HISTORIAL (Tu lógica de clinicalHistory) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 min-h-screen">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3 mb-8">
              <ClipboardList className="text-teal-500" /> Evolución Clínica
            </h2>
            
            <div className="space-y-6">
              {history.length > 0 ? (
                history.map((entry) => (
                  <div key={entry.id} className="border-l-4 border-teal-500 pl-6 py-2 relative">
                    <div className="absolute w-3 h-3 bg-teal-500 rounded-full -left-[8px] top-4 shadow-[0_0_0_4px_rgba(20,184,166,0.1)]"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      {new Date(entry.date).toLocaleDateString('es-AR')}
                    </p>
                    <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {entry.evolution}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <ClipboardList size={48} />
                  <p className="font-bold uppercase text-xs mt-4">Sin evoluciones registradas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}