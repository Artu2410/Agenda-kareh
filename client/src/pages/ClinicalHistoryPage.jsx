import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, FileText, Eye, EyeOff, Trash2, AlertTriangle, PlusCircle, 
  Loader, X, Upload, Camera, Printer, Calendar, CheckCircle2, ChevronLeft 
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ClinicalHistoryPage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const timers = useRef({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Ajustado para usar las rutas correctas de tu backend
        const [pRes, hRes] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/patients/${patientId}/history`) 
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
        toast.error('Error al cargar la historia clínica');
      } finally {
        setLoading(false);
      }
    };
    if (patientId) fetchData();
  }, [patientId]);

  // ... (Aquí sigue todo tu código de autoguardado y funciones de apoyo que ya tienes)
  // IMPORTANTE: Asegúrate de mantener tus funciones calculateAge, triggerAutoSave, etc.

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-teal-600 w-12 h-12" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen relative shadow-2xl shadow-slate-200 overflow-y-auto">
       <button onClick={() => navigate('/clinical-histories')} className="no-print flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] tracking-widest mb-6">
        <ChevronLeft size={16} /> Volver a la lista
      </button>
      
      {/* Todo tu diseño de Header KAREH, Grid de Alertas y Evoluciones */}
      <header className="mb-10 border-b border-slate-100 pb-6 flex justify-between items-end">
         <div>
           <h1 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">KAREH</h1>
           <h2 className="text-5xl font-black text-slate-800 uppercase tracking-tight italic">{patient?.fullName}</h2>
         </div>
         <button onClick={() => window.print()} className="no-print px-6 py-3 bg-teal-50 text-teal-700 rounded-2xl font-black text-[10px] border border-teal-100">
           <Printer size={16} /> IMPRIMIR
         </button>
      </header>

      {/* ... Resto del renderizado de evoluciones ... */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Aquí va tu sección de Información Base y Alertas Médicas */}
          {/* Y tu Cronología de Sesiones con el map de historyEntries */}
          <div className="md:col-span-4 italic text-slate-400 text-xs">Mostrando historia clínica completa de {patient?.fullName}</div>
      </div>
    </div>
  );
};

export default ClinicalHistoryPage;