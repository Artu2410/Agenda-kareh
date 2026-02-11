import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, FileText, Eye, Trash2, AlertTriangle, PlusCircle, 
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
  
  const timers = useRef({});

  // --- 1. CARGA DE DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // RUTAS CORREGIDAS PARA CONEXIÓN
        const [pRes, hRes] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/clinical-history/${patientId}`)
        ]);
        
        setPatient(pRes.data);
        
        const formattedEntries = (Array.isArray(hRes.data) ? hRes.data : []).map(e => ({ 
          ...e, 
          attachments: ensureArray(e.attachments),
          date: e.createdAt || e.date,
          status: 'saved' 
        }));
        setHistoryEntries(formattedEntries);
      } catch (err) {
        console.error("Error al cargar:", err);
        toast.error('Error al conectar con el servidor');
      } finally {
        setLoading(false);
      }
    };
    if (patientId) fetchData();
  }, [patientId]);

  // --- 2. LÓGICA DE AUTOGUARDADO ---
  const triggerAutoSave = (entry) => {
    const id = entry.id;
    setHistoryEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'typing' } : e));
    if (timers.current[id]) clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      saveEntry(entry);
    }, 2000);
  };

  const saveEntry = async (entry) => {
    if (!entry.evolution?.trim() && entry.id.toString().startsWith('temp-')) return;
    setHistoryEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'saving' } : e));
    try {
      const payload = {
        patientId,
        diagnosis: entry.diagnosis || "",
        evolution: entry.evolution || "",
        createdAt: entry.date,
        attachments: JSON.stringify(entry.attachments)
      };

      let res;
      if (entry.id.toString().startsWith('temp-')) {
        res = await api.post('/clinical-history', payload);
      } else {
        res = await api.put(`/clinical-history/${entry.id}`, payload);
      }
      
      const savedData = { 
        ...res.data, 
        attachments: ensureArray(res.data.attachments), 
        date: res.data.createdAt,
        status: 'saved' 
      };
      setHistoryEntries(prev => prev.map(e => (e.id === entry.id ? savedData : e)));
    } catch (err) {
      setHistoryEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e));
    }
  };

  // --- 3. FUNCIONES DE APOYO ---
  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate);
    const age = new Date().getFullYear() - birth.getFullYear();
    return age;
  };

  const ensureArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try { return JSON.parse(data) || []; } catch { return []; }
  };

  const handleUpdatePatient = async (field, value) => {
    try {
      await api.patch(`/patients/${patientId}`, { [field]: value });
      setPatient(prev => ({ ...prev, [field]: value }));
      toast.success("Actualizado");
    } catch (err) {
      toast.error("Error de actualización");
    }
  };

  const handleEntryChange = (id, field, value) => {
    setHistoryEntries(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, [field]: value };
        triggerAutoSave(updated);
        return updated;
      }
      return e;
    }));
  };

  const handleFileUpload = (entryId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newFile = { name: file.name, type: file.type, data: event.target.result };
      setHistoryEntries(prev => prev.map(h => {
        if (h.id === entryId) {
          const updated = { ...h, attachments: [...h.attachments, newFile] };
          saveEntry(updated);
          return updated;
        }
        return h;
      }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-teal-600 w-12 h-12" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen relative shadow-2xl">
      <style>{`@media print { nav, aside, button, .no-print { display: none !important; } .max-w-6xl { max-width: 100% !important; margin: 0 !important; } }`}</style>
      
      <button onClick={() => navigate('/clinical-histories')} className="no-print flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] tracking-widest mb-6">
        <ChevronLeft size={16} /> Volver a la lista
      </button>

      <header className="mb-10 border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-[11px] font-black text-teal-600 uppercase tracking-[0.3em] mb-2">Historia Clinica</h1>
          <h2 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter">{patient?.fullName}</h2>
        </div>
        <button onClick={() => window.print()} className="no-print px-6 py-3 bg-teal-50 text-teal-700 rounded-2xl font-black text-[10px] border border-teal-100">
          <Printer size={16} /> IMPRIMIR
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-6">
          <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase mb-5 tracking-widest">Información Base</h3>
            <div className="space-y-4 text-[11px]">
              <p className="flex justify-between border-b pb-2"><b>DNI:</b> <span>{patient?.dni}</span></p>
              <p className="flex justify-between border-b pb-2"><b>EDAD:</b> <span className="bg-teal-100 px-2 rounded-lg">{calculateAge(patient?.birthDate)} años</span></p>
              <p className="flex justify-between"><b>OS:</b> <span className="text-teal-600 uppercase">{patient?.healthInsurance || 'Particular'}</span></p>
            </div>
          </section>

          <section className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100">
            <h3 className="text-[10px] font-black text-amber-600 uppercase mb-5 tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} /> Alertas
            </h3>
            <div className="space-y-2">
              {['hasCancer', 'hasMarcapasos', 'usesEA'].map(id => (
                <label key={id} className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-sm text-[10px] font-bold uppercase cursor-pointer">
                  {id.replace('has', '').replace('uses', '')}
                  <input type="checkbox" checked={!!patient?.[id]} onChange={(e) => handleUpdatePatient(id, e.target.checked)} className="accent-teal-500 no-print" />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="md:col-span-3 space-y-8">
          <div className="flex justify-between items-center no-print">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cronología</h2>
            <button 
              onClick={() => setHistoryEntries([{ id: `temp-${Date.now()}`, date: new Date().toISOString().split('T')[0], diagnosis: '', evolution: '', attachments: [], status: 'typing' }, ...historyEntries])}
              className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2"
            >
              <PlusCircle size={16} /> NUEVA SESIÓN
            </button>
          </div>

          {historyEntries.map((entry) => (
            <div key={entry.id} className="border-2 border-slate-100 rounded-[2.5rem] bg-white overflow-hidden shadow-sm hover:border-teal-200 transition-all">
              <div className="bg-slate-50 px-8 py-4 border-b flex justify-between items-center">
                <input type="date" className="bg-white px-3 py-1.5 rounded-xl border font-black text-teal-700 text-[11px] outline-none" value={entry.date?.split('T')[0]} onChange={(e) => handleEntryChange(entry.id, 'date', e.target.value)} />
                <div className="text-[9px] font-black">
                  {entry.status === 'saved' && <span className="text-teal-500 italic">GUARDADO</span>}
                  {entry.status === 'saving' && <span className="text-amber-500 animate-pulse">GUARDANDO...</span>}
                </div>
              </div>
              <div className="p-8 space-y-4">
                <input className="w-full text-xl font-black text-slate-800 uppercase outline-none" placeholder="DIAGNÓSTICO..." value={entry.diagnosis} onChange={(e) => handleEntryChange(entry.id, 'diagnosis', e.target.value)} />
                <textarea className="w-full text-sm text-slate-600 outline-none min-h-[120px] bg-slate-50/50 p-6 rounded-3xl resize-none" placeholder="Evolución..." value={entry.evolution} onChange={(e) => handleEntryChange(entry.id, 'evolution', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClinicalHistoryPage;