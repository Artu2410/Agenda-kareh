import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, FileText, Eye, EyeOff, Trash2, AlertTriangle, PlusCircle, 
  Loader, X, Upload, Camera, Printer, Calendar, CheckCircle2, ChevronLeft 
} from 'lucide-center';
import api from '../services/api';
import toast from 'react-hot-toast';

const ClinicalHistoryPage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const timers = useRef({});

  useEffect(() => {
    const fetchData = async () => {
      if (!patientId) return;
      try {
        setLoading(true);
        // Intentamos obtener el paciente y su historia
        const [pRes, hRes] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/clinical-history/${patientId}`)
        ]);
        
        setPatient(pRes.data);
        const formattedEntries = hRes.data.map(e => ({ 
          ...e, 
          attachments: e.attachments ? (typeof e.attachments === 'string' ? JSON.parse(e.attachments) : e.attachments) : [],
          date: e.createdAt || e.date,
          status: 'saved',
          hiddenForPrint: false
        }));
        setHistoryEntries(formattedEntries);
      } catch (err) {
        console.error("Error cargando ficha:", err);
        toast.error('No se pudo cargar la información');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [patientId]);

  // Funciones de apoyo (Mantener las que ya tienes: calculateAge, handleUpdatePatient, etc.)
  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate);
    const age = new Date().getFullYear() - birth.getFullYear();
    return age;
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-teal-600 w-12 h-12" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen relative shadow-2xl shadow-slate-200 overflow-y-auto">
      <button onClick={() => navigate('/clinical-histories')} className="no-print flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] tracking-widest mb-6">
        <ChevronLeft size={16} /> Volver a Historias
      </button>

      <header className="mb-10 border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-[11px] font-black text-teal-600 uppercase tracking-[0.3em] mb-2">KAREH · Historia Clínica</h1>
          <h2 className="text-5xl font-black text-slate-800 uppercase tracking-tight italic">{patient?.fullName}</h2>
        </div>
        <button onClick={() => window.print()} className="no-print px-6 py-3 bg-teal-50 text-teal-700 rounded-2xl font-black text-[10px] border border-teal-100">
          <Printer size={16} /> IMPRIMIR
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-6">
           <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
             <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Datos Base</p>
             <div className="text-[11px] space-y-2">
               <p className="flex justify-between"><b>DNI:</b> {patient?.dni}</p>
               <p className="flex justify-between"><b>EDAD:</b> {calculateAge(patient?.birthDate)} años</p>
             </div>
           </div>
        </div>
        
        <div className="md:col-span-3">
            {/* Aquí va tu mapeo de historyEntries.map(...) */}
            <p className="text-slate-400 uppercase font-black text-[10px]">Historial de Sesiones</p>
            {historyEntries.length === 0 && <p className="py-10 text-center text-slate-300 font-bold uppercase">No hay sesiones registradas</p>}
        </div>
      </div>
    </div>
  );
};

export default ClinicalHistoryPage;