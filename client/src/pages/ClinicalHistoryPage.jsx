import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Save, FileText, Eye, Trash2, AlertTriangle, PlusCircle, 
  Loader, X, Upload, Camera, Printer, Calendar, CheckCircle2 
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ClinicalHistoryPage = () => {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Referencia para manejar los cronómetros de autoguardado por cada entrada
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
        
        // Formatear entradas al cargar
        const formattedEntries = hRes.data.map(e => ({ 
          ...e, 
          attachments: ensureArray(e.attachments),
          date: e.createdAt || e.date,
          status: 'saved' // Estado: saved, typing, saving
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

  // --- 2. LÓGICA DE AUTOGUARDADO (DEBOUNCE) ---
  const triggerAutoSave = (entry) => {
    const id = entry.id;
    
    // Cambiamos estado visual a "escribiendo"
    setHistoryEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'typing' } : e));

    if (timers.current[id]) clearTimeout(timers.current[id]);

    timers.current[id] = setTimeout(() => {
      saveEntry(entry);
    }, 2000); // Guarda tras 2 segundos de inactividad
  };

  const saveEntry = async (entry) => {
    // No autoguardar si es una entrada nueva totalmente vacía
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
      console.error("Error saving entry:", err);
    }
  };

  // --- 3. FUNCIONES DE APOYO ---
  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
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
      toast.success("Antecedentes actualizados");
    } catch (err) {
      toast.error("Error al actualizar paciente");
    }
  };

  const handleEntryChange = (id, field, value) => {
    setHistoryEntries(prev => {
      return prev.map(e => {
        if (e.id === id) {
          const updated = { ...e, [field]: value };
          triggerAutoSave(updated);
          return updated;
        }
        return e;
      });
    });
  };

  const handleFileUpload = (entryId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newFile = { 
        name: file.name, 
        type: file.type, 
        data: event.target.result 
      };
      setHistoryEntries(prev => {
        const updatedEntries = prev.map(h => {
          if (h.id === entryId) {
            const updated = { ...h, attachments: [...h.attachments, newFile] };
            saveEntry(updated); // Guardamos inmediatamente al subir archivo
            return updated;
          }
          return h;
        });
        return updatedEntries;
      });
    };
    reader.readAsDataURL(file);
  };

  const viewFile = (file) => {
    if (!file.data) return;
    try {
      const base64Parts = file.data.split(',');
      const contentType = base64Parts[0].split(':')[1].split(';')[0];
      const byteCharacters = atob(base64Parts[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (e) { toast.error("Error al abrir archivo"); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-teal-600 w-12 h-12" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen relative shadow-2xl shadow-slate-200">
      
      {/* ESTILOS DE IMPRESIÓN */}
      <style>{`
          @media print {
            nav, aside, button, .no-print, .print-hidden { display: none !important; }
            body { background: white; padding: 0; }
            .max-w-6xl { max-width: 100% !important; margin: 0 !important; }
            .rounded-[2rem], .rounded-3xl, .border-2 { border-radius: 0 !important; border: 1px solid #eee !important; box-shadow: none !important; }
            textarea { border: none !important; resize: none !important; background: transparent !important; }
          }
      `}</style>

      {/* HEADER KAREH */}
      <header className="mb-10 border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">KAREH</h1>
          <h1 className="text-[11px] font-black text-teal-600 uppercase tracking-[0.3em] mb-2">Historia Clinica</h1>
          <h2 className="text-5xl font-black text-slate-800 uppercase tracking-tight italic">{patient?.fullName}</h2>
        </div>
        <button 
          onClick={() => window.print()}
          className="no-print px-6 py-3 bg-teal-50 text-teal-700 rounded-2xl hover:bg-teal-100 transition-all flex items-center gap-2 font-black text-[10px] border border-teal-100 shadow-sm"
        >
          <Printer size={16} /> IMPRIMIR HISTORIA
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* COLUMNA IZQUIERDA: IDENTIDAD Y ANTECEDENTES */}
        <div className="md:col-span-1 space-y-6">
          <section className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase mb-5 tracking-widest">Información Base</h3>
            <div className="space-y-4 text-[11px]">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Documento</span>
                <span className="font-black text-slate-800">{patient?.dni}</span>
              </div>

              {/* FECHA DE NACIMIENTO CARGADA */}
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Nacimiento</span>
                <span className="font-black text-slate-800 flex items-center gap-1 text-right">
                  <Calendar size={12} className="text-teal-500" />
                  {patient?.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-AR') : '---'}
                </span>
              </div>

              {/* EDAD CALCULADA */}
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Edad Actual</span>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-lg font-black italic">
                  {calculateAge(patient?.birthDate)} AÑOS
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Cobertura</span>
                <span className="font-black text-teal-600 uppercase text-right">{patient?.healthInsurance || 'Particular'}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">Contacto</span>
                <span className="font-black text-slate-800">{patient?.phone}</span>
              </div>
            </div>
          </section>

          <section className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100">
            <h3 className="text-[10px] font-black text-amber-600 uppercase mb-5 tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} /> Alertas Médicas
            </h3>
            <div className="space-y-2">
              {[
                { id: 'hasCancer', label: 'Oncológico', color: 'accent-red-500' },
                { id: 'hasMarcapasos', label: 'Marcapasos', color: 'accent-blue-500' },
                { id: 'usesEA', label: 'EA', color: 'accent-amber-500' }
              ].map(ant => (
                <label key={ant.id} className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${patient?.[ant.id] ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-100'}`}>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">{ant.label}</span>
                  <input 
                    type="checkbox" 
                    className={`w-4 h-4 rounded-lg ${ant.color} no-print`}
                    checked={!!patient?.[ant.id]}
                    onChange={(e) => handleUpdatePatient(ant.id, e.target.checked)}
                  />
                  <span className="hidden print:inline font-black text-[10px]">{patient?.[ant.id] ? 'SÍ' : 'NO'}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA: EVOLUCIONES CON AUTOGUARDADO */}
        <div className="md:col-span-3 space-y-8">
          <div className="flex justify-between items-center no-print">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Calendar size={16}/> Cronología de Sesiones
            </h2>
            <button 
              onClick={() => setHistoryEntries([{
                id: `temp-${Date.now()}`, 
                date: new Date().toISOString().split('T')[0], 
                diagnosis: '', evolution: '', attachments: [], status: 'typing'
              }, ...historyEntries])}
              className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <PlusCircle size={16} /> NUEVA SESIÓN
            </button>
          </div>

          {historyEntries.map((entry) => (
            <div key={entry.id} className="border-2 border-slate-100 rounded-[2.5rem] overflow-hidden bg-white shadow-sm hover:border-teal-200 transition-all group">
              
              {/* BARRA SUPERIOR DE SESIÓN */}
              <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex justify-between items-center group-hover:bg-teal-50/30">
                <input 
                    type="date" 
                    className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-black text-teal-700 text-[11px] outline-none shadow-sm uppercase"
                    value={entry.date?.split('T')[0]}
                    onChange={(e) => handleEntryChange(entry.id, 'date', e.target.value)}
                />
                
                {/* INDICADOR DE ESTADO VISUAL */}
                <div className="flex items-center gap-2 pr-4">
                    {entry.status === 'saving' && <span className="text-[10px] font-black text-teal-600 animate-pulse flex items-center gap-1"><Loader size={12} className="animate-spin"/> GUARDANDO...</span>}
                    {entry.status === 'typing' && <span className="text-[10px] font-black text-amber-500 flex items-center gap-1">ESCRIBIENDO...</span>}
                    {entry.status === 'saved' && <span className="text-[10px] font-black text-slate-400 flex items-center gap-1"><CheckCircle2 size={12} className="text-teal-500"/> SESIÓN GUARDADA</span>}
                    {entry.status === 'error' && <span className="text-[10px] font-black text-red-500 flex items-center gap-1">ERROR AL GUARDAR</span>}
                </div>
              </div>

              <div className="p-8 space-y-5">
                <input 
                  className="w-full text-xl font-black text-slate-800 placeholder:text-slate-200 uppercase outline-none"
                  placeholder="DIAGNÓSTICO O MOTIVO DE CONSULTA..."
                  value={entry.diagnosis}
                  onChange={(e) => handleEntryChange(entry.id, 'diagnosis', e.target.value)}
                />
                
                <textarea 
                  className="w-full text-sm text-slate-600 leading-relaxed outline-none min-h-[140px] bg-slate-50/50 p-6 rounded-[2rem] resize-none focus:bg-white focus:ring-2 ring-teal-50 border border-transparent focus:border-teal-100 transition-all"
                  placeholder="Escriba aquí la evolución detallada del paciente..."
                  value={entry.evolution}
                  onChange={(e) => handleEntryChange(entry.id, 'evolution', e.target.value)}
                />

                {/* ADJUNTOS */}
                <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-4 no-print">
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 text-teal-600 text-[9px] font-black cursor-pointer bg-teal-50 px-4 py-2.5 rounded-xl border border-teal-100 hover:bg-teal-100 transition-colors">
                      <Camera size={14}/> FOTOGRAFÍA
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(entry.id, e)} />
                    </label>
                    <label className="flex items-center gap-2 text-slate-500 text-[9px] font-black cursor-pointer bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                      <Upload size={14}/> DOCUMENTO
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(entry.id, e)} />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {entry.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 px-3 bg-white border border-slate-200 rounded-xl shadow-sm animate-in fade-in">
                        <span className="text-[9px] font-black text-slate-400 uppercase italic truncate max-w-[100px]">{file.name}</span>
                        <div className="flex border-l ml-1 pl-1 gap-1">
                           <button onClick={() => viewFile(file)} className="p-1 text-teal-600 hover:bg-teal-50 rounded"><Eye size={14}/></button>
                           <button onClick={() => {
                              const filtered = entry.attachments.filter((_, i) => i !== idx);
                              handleEntryChange(entry.id, 'attachments', filtered);
                           }} className="p-1 text-red-300 hover:text-red-500 rounded"><X size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClinicalHistoryPage;