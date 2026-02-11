import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, FileText, Eye, EyeOff, Trash2, AlertTriangle, PlusCircle, 
  Loader, X, Upload, Camera, Printer, Calendar, CheckCircle2, ChevronLeft, Search
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ClinicalHistoryPage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateSearch, setDateSearch] = useState('');
  
  const timers = useRef({});

  // --- 1. CARGA DE DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [pRes, hRes] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/clinical-history/${patientId}`)
        ]);
        
        setPatient(pRes.data);
        
        const formattedEntries = (Array.isArray(hRes.data) ? hRes.data : []).map(e => ({ 
          ...e, 
          attachments: ensureArray(e.attachments),
          // FIX FECHA: Evitar el descuento de un día
          date: e.createdAt ? e.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          status: 'saved',
          isVisible: true // Para impresión selectiva
        }));
        setHistoryEntries(formattedEntries);
      } catch (err) {
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
    timers.current[id] = setTimeout(() => saveEntry(entry), 2000);
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
        date: res.data.createdAt.split('T')[0],
        status: 'saved',
        isVisible: true
      };
      setHistoryEntries(prev => prev.map(e => (e.id === entry.id ? savedData : e)));
    } catch (err) {
      setHistoryEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e));
    }
  };

  const deleteEntry = async (id) => {
    if (id.toString().startsWith('temp-')) {
      setHistoryEntries(prev => prev.filter(e => e.id !== id));
      return;
    }
    if (!window.confirm("¿Eliminar esta evolución permanentemente?")) return;
    try {
      await api.delete(`/clinical-history/${id}`);
      setHistoryEntries(prev => prev.filter(e => e.id !== id));
      toast.success("Evolución eliminada");
    } catch (err) {
      toast.error("No se pudo eliminar");
    }
  };

  // --- 3. FUNCIONES DE APOYO ---
  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate + 'T00:00:00'); // Fix zona horaria
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
      toast.success("Ficha actualizada");
    } catch (err) {
      toast.error("Error");
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

  const toggleVisibility = (id) => {
    setHistoryEntries(prev => prev.map(e => e.id === id ? { ...e, isVisible: !e.isVisible } : e));
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

  const filteredEntries = historyEntries.filter(e => e.date.includes(dateSearch));

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-teal-600 w-12 h-12" /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto p-6 bg-white shadow-2xl min-h-screen">
        <style>{`
          @media print { 
            nav, aside, button, .no-print, .is-hidden { display: none !important; } 
            .max-w-6xl { max-width: 100% !important; margin: 0 !important; box-shadow: none !important; }
            .session-card { border: 1px solid #eee !important; margin-bottom: 20px !important; break-inside: avoid; }
          }
        `}</style>
        
        <button onClick={() => navigate('/clinical-histories')} className="no-print flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] mb-6">
          <ChevronLeft size={16} /> Volver
        </button>

        <header className="mb-10 border-b border-slate-100 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-[11px] font-black text-teal-600 uppercase tracking-[0.3em] mb-2">KAREH · Historia Clínica</h1>
            <h2 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter">{patient?.fullName}</h2>
          </div>
          <button onClick={() => window.print()} className="no-print px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] flex items-center gap-2">
            <Printer size={16} /> IMPRIMIR SELECCIONADOS
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* COLUMNA INFO */}
          <div className="md:col-span-1 space-y-6 no-print">
            <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4">Información Base</h3>
              <div className="space-y-3 text-[11px]">
                <p className="flex justify-between border-b pb-2"><b>DNI:</b> <span>{patient?.dni}</span></p>
                <p className="flex justify-between border-b pb-2"><b>EDAD:</b> <span className="bg-teal-100 px-2 rounded-lg font-black">{calculateAge(patient?.birthDate)} años</span></p>
                <p className="flex justify-between"><b>OS:</b> <span className="text-teal-600 font-black">{patient?.healthInsurance || 'Particular'}</span></p>
              </div>
            </section>

            <section className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100">
              <h3 className="text-[10px] font-black text-amber-600 uppercase mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Alertas</h3>
              <div className="space-y-2">
                {['hasCancer', 'hasMarcapasos', 'usesEA'].map(id => (
                  <label key={id} className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-sm text-[10px] font-bold uppercase cursor-pointer">
                    {id.replace('has', '').replace('uses', '')}
                    <input type="checkbox" checked={!!patient?.[id]} onChange={(e) => handleUpdatePatient(id, e.target.checked)} className="accent-teal-500" />
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* COLUMNA CRONOLOGÍA */}
          <div className="md:col-span-3 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 no-print bg-slate-50 p-4 rounded-3xl">
              <div className="relative w-full md:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por fecha (AAAA-MM)..." 
                  className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200"
                  value={dateSearch}
                  onChange={(e) => setDateSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setHistoryEntries([{ id: `temp-${Date.now()}`, date: new Date().toISOString().split('T')[0], diagnosis: '', evolution: '', attachments: [], status: 'typing', isVisible: true }, ...historyEntries])}
                className="w-full md:w-auto bg-teal-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 shadow-lg shadow-teal-100"
              >
                <PlusCircle size={16} /> NUEVA SESIÓN
              </button>
            </div>

            {filteredEntries.map((entry) => (
              <div 
                key={entry.id} 
                className={`session-card border-2 transition-all rounded-[2.5rem] bg-white overflow-hidden ${!entry.isVisible ? 'opacity-40 grayscale is-hidden' : 'border-slate-100 shadow-sm'}`}
              >
                <div className="bg-slate-50 px-8 py-4 border-b flex justify-between items-center">
                  <input 
                    type="date" 
                    className="bg-white px-3 py-1.5 rounded-xl border font-black text-teal-700 text-[11px] outline-none shadow-sm" 
                    value={entry.date} 
                    onChange={(e) => handleEntryChange(entry.id, 'date', e.target.value)} 
                  />
                  
                  <div className="flex items-center gap-3 no-print">
                    <button 
                      onClick={() => toggleVisibility(entry.id)} 
                      className={`p-2 rounded-xl border transition-all ${entry.isVisible ? 'bg-white text-slate-400 border-slate-200' : 'bg-amber-100 text-amber-600 border-amber-200'}`}
                      title={entry.isVisible ? "Ocultar de impresión" : "Mostrar en impresión"}
                    >
                      {entry.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button 
                      onClick={() => deleteEntry(entry.id)} 
                      className="p-2 bg-white text-red-400 border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="text-[9px] font-black uppercase ml-2">
                      {entry.status === 'saved' && <span className="text-teal-500 italic">Guardado</span>}
                      {entry.status === 'saving' && <span className="text-amber-500 animate-pulse">Guardando...</span>}
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-4">
                  <input 
                    className="w-full text-xl font-black text-slate-800 uppercase outline-none placeholder:text-slate-200" 
                    placeholder="DIAGNÓSTICO..." 
                    value={entry.diagnosis} 
                    onChange={(e) => handleEntryChange(entry.id, 'diagnosis', e.target.value)} 
                  />
                  <textarea 
                    className="w-full text-sm text-slate-600 outline-none min-h-[120px] bg-slate-50/50 p-6 rounded-3xl resize-none focus:bg-white transition-all" 
                    placeholder="Evolución de la sesión..." 
                    value={entry.evolution} 
                    onChange={(e) => handleEntryChange(entry.id, 'evolution', e.target.value)} 
                  />

                  {/* ADJUNTOS CON FIX PARA CELULAR */}
                  <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-4 no-print">
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 text-teal-600 text-[9px] font-black cursor-pointer bg-teal-50 px-4 py-2 rounded-xl border border-teal-100">
                        <Camera size={14}/> FOTOGRAFÍA
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(entry.id, e)} />
                      </label>
                      <label className="flex items-center gap-2 text-slate-500 text-[9px] font-black cursor-pointer bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                        <Upload size={14}/> DOCUMENTO
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(entry.id, e)} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalHistoryPage;