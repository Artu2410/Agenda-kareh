import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Save, FileText, Eye, EyeOff, Trash2, AlertTriangle, PlusCircle, 
  Loader, X, Upload, Camera, Printer, Calendar, CheckCircle2, ChevronLeft, Search, Maximize2
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useConfirmModal } from '../components/ConfirmModal';
import {
  APP_ROUTES,
  persistClinicalHistoryContext,
  readClinicalHistoryContext,
} from '../utils/appRoutes';

const ClinicalHistoryPage = () => {
  const { legacyPatientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const [patient, setPatient] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateSearch, setDateSearch] = useState('');
  
  const timers = useRef({});
  const storedHistoryContext = readClinicalHistoryContext();
  const activePatientId = location.state?.patientId || storedHistoryContext?.patientId || legacyPatientId || null;

  useEffect(() => {
    if (location.state?.patientId) {
      persistClinicalHistoryContext({
        patientId: location.state.patientId,
        patientName: location.state.patientName || '',
      });
    }
  }, [location.state]);

  // --- 1. FUNCIONES DE APOYO ---
  
  const calculateAge = (birthDate) => {
    if (!birthDate) return '...';
    // Normalizamos la fecha eliminando la parte de la hora si existe
    const dateString = birthDate.includes('T') ? birthDate.split('T')[0] : birthDate;
    const [year, month, day] = dateString.split('-').map(Number);
    
    const birth = new Date(year, month - 1, day);
    if (isNaN(birth.getTime())) return 'N/A';

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age < 0 ? 0 : age;
  };

  const ensureArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try { return JSON.parse(data) || []; } catch { return []; }
  };

  const openImage = (base64Data) => {
    const win = window.open();
    win.document.write(`<iframe src="${base64Data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  };

  // --- 2. CARGA DE DATOS ---
  useEffect(() => {
    if (!activePatientId) {
      navigate(APP_ROUTES.clinicalHistories, { replace: true });
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [pRes, hRes] = await Promise.all([
          api.get(`/patients/${activePatientId}`),
          api.get(`/clinical-history/${activePatientId}`)
        ]);
        
        setPatient(pRes.data);
        persistClinicalHistoryContext({
          patientId: pRes.data.id || activePatientId,
          patientName: pRes.data.fullName || '',
        });
        
        const formattedEntries = (Array.isArray(hRes.data) ? hRes.data : []).map(e => ({ 
          ...e, 
          attachments: ensureArray(e.attachments),
          date: e.createdAt ? e.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          status: 'saved',
          isVisible: true 
        }));
        setHistoryEntries(formattedEntries);
      } catch {
        toast.error('Error al conectar con el servidor');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activePatientId, navigate]);

  useEffect(() => {
    if (patient?.fullName) {
      document.title = `Agenda Kareh | ${patient.fullName}`;
    }
  }, [patient]);

  // --- 3. LÓGICA DE PERSISTENCIA ---
  
  const handleUpdatePatient = async (field, value) => {
    try {
      // Usamos PATCH si el servidor lo permite, si no, usa PUT enviando todo el objeto
      await api.patch(`/patients/${activePatientId}`, { [field]: value });
      setPatient(prev => ({ ...prev, [field]: value }));
      toast.success("Ficha actualizada");
    } catch (err) {
      console.error("Error al actualizar paciente:", err);
      toast.error("Error al actualizar la ficha");
    }
  };

  const saveEntry = async (entry) => {
    if (!entry.evolution?.trim() && !entry.diagnosis?.trim() && entry.id.toString().startsWith('temp-')) return;
    
    setHistoryEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'saving' } : e));
    try {
      const payload = {
        patientId: activePatientId,
        diagnosis: entry.diagnosis || "",
        evolution: entry.evolution || "",
        createdAt: entry.date,
        attachments: JSON.stringify(entry.attachments)
      };

      let res = entry.id.toString().startsWith('temp-')
        ? await api.post('/clinical-history', payload)
        : await api.put(`/clinical-history/${entry.id}`, payload);
      
      const savedData = { 
        ...res.data, 
        attachments: ensureArray(res.data.attachments), 
        date: res.data.createdAt.split('T')[0],
        status: 'saved',
        isVisible: true
      };
      setHistoryEntries(prev => prev.map(e => (e.id === entry.id ? savedData : e)));
    } catch {
      setHistoryEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e));
    }
  };

  const handleFileUpload = (entryId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast.loading("Procesando imagen...", { id: 'uploading' });
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        const newFile = { name: "foto.jpg", type: "image/jpeg", data: compressedBase64 };
        
        setHistoryEntries(prev => prev.map(h => {
          if (h.id === entryId) {
            const updated = { ...h, attachments: [...h.attachments, newFile] };
            saveEntry(updated);
            return updated;
          }
          return h;
        }));
        toast.success("Imagen guardada", { id: 'uploading' });
      };
    };
    reader.readAsDataURL(file);
  };

  // --- 4. RENDER ---
  const filteredEntries = historyEntries.filter(e => e.date.includes(dateSearch));
  const printableEntries = filteredEntries.filter(entry => entry.isVisible !== false);

  const formatDisplayDate = (value) => {
    if (!value) return 'Sin fecha';
    const normalized = value.includes('T') ? value : `${value}T12:00:00`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-AR');
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <Loader className="animate-spin text-teal-600 w-12 h-12" />
    </div>
  );

  return (
    <>
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen pb-20">
      <div className="max-w-6xl mx-auto p-6 bg-white shadow-2xl min-h-screen">
        <style>{`
          .print-layout { display: none; }

          @media print { 
            @page {
              size: A4;
              margin: 14mm;
            }

            html, body {
              background: #f4f5f7 !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            nav, aside, .screen-layout, .no-print, .is-hidden {
              display: none !important;
            }

            .print-layout {
              display: block !important;
            }

            .max-w-6xl {
              max-width: 100% !important;
              margin: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
              background: #f4f5f7 !important;
              min-height: auto !important;
              overflow: visible !important;
            }

            .print-shell {
              background: #f4f5f7 !important;
              color: #1e293b !important;
              overflow: visible !important;
            }

            .print-header,
            .print-sidebar-card,
            .print-session-card {
              break-inside: avoid;
              box-shadow: none !important;
            }

            .overflow-y-auto,
            .custom-scrollbar,
            .flex-1,
            .min-h-screen {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
            }

            *::-webkit-scrollbar {
              display: none !important;
            }
          }
        `}</style>
        
        <div className="screen-layout">
          <button onClick={() => navigate(APP_ROUTES.clinicalHistories)} className="no-print flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] mb-6">
            <ChevronLeft size={16} /> Volver al listado
          </button>

          <header className="mb-10 border-b border-slate-100 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-[11px] font-black text-teal-600 uppercase tracking-[0.3em] mb-2">KAREH · Historia Clínica</h1>
              <h2 className="text-4xl md:text-5xl font-black text-slate-800 uppercase italic tracking-tighter">
                {patient?.fullName}
              </h2>
            </div>
            <button onClick={() => window.print()} className="no-print px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] flex items-center gap-2 shadow-lg hover:bg-slate-800">
              <Printer size={16} /> IMPRIMIR SESIONES
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1 space-y-6 no-print">
            <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Ficha Base</h3>
              <div className="space-y-3 text-[11px]">
                <p className="flex justify-between border-b border-slate-200 pb-2"><b>DNI:</b> <span>{patient?.dni}</span></p>
                
                <div className="border-b border-slate-200 pb-2">
                  <p className="text-[9px] text-slate-400 font-black mb-1 uppercase">Fecha Nacimiento:</p>
                  <input 
                    type="date" 
                    value={patient?.birthDate ? patient.birthDate.split('T')[0] : ''}
                    onChange={(e) => handleUpdatePatient('birthDate', e.target.value)}
                    className="w-full bg-transparent font-bold text-slate-700 outline-none focus:text-teal-600"
                  />
                </div>

                <p className="flex justify-between border-b border-slate-200 pb-2">
                  <b>EDAD:</b> 
                  <span className="bg-teal-100 px-2 rounded-lg font-black text-teal-700">
                    {calculateAge(patient?.birthDate)} años
                  </span>
                </p>
                <p className="flex justify-between"><b>OS:</b> <span className="text-teal-600 font-black uppercase">{patient?.healthInsurance || 'Particular'}</span></p>
                <div className="border-t border-slate-200 pt-2">
                  <p className="text-[9px] text-slate-400 font-black mb-1 uppercase">N° Afiliado:</p>
                  <input
                    type="text"
                    value={patient?.affiliateNumber || ''}
                    onChange={(e) => handleUpdatePatient('affiliateNumber', e.target.value)}
                    className="w-full bg-transparent font-bold text-slate-700 outline-none focus:text-teal-600"
                    placeholder="Sin número"
                  />
                </div>
              </div>
            </section>

            <section className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 shadow-sm">
              <h3 className="text-[10px] font-black text-amber-600 uppercase mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Riesgos</h3>
              <div className="space-y-2">
                {[{id:'hasCancer', l:'Cáncer'}, {id:'hasMarcapasos', l:'Marcapasos'}, {id:'usesEA', l:'Usa EA'}].map(item => (
                  <label key={item.id} className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-sm text-[10px] font-bold uppercase cursor-pointer hover:bg-amber-50 transition-all">
                    {item.l}
                    <input 
                      type="checkbox" 
                      checked={!!patient?.[item.id]} 
                      onChange={(e) => handleUpdatePatient(item.id, e.target.checked)} 
                      className="w-4 h-4 accent-teal-600" 
                    />
                  </label>
                ))}
              </div>
            </section>
            </div>

            <div className="md:col-span-3 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 no-print bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="relative w-full md:w-64">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por fecha..." 
                    className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-teal-400 transition-all"
                    value={dateSearch}
                    onChange={(e) => setDateSearch(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setHistoryEntries([{ id: `temp-${Date.now()}`, date: new Date().toISOString().split('T')[0], diagnosis: '', evolution: '', attachments: [], status: 'typing', isVisible: true }, ...historyEntries])}
                  className="w-full md:w-auto bg-teal-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 shadow-lg hover:bg-teal-700"
                >
                  <PlusCircle size={16} /> NUEVA EVOLUCIÓN
                </button>
              </div>

              {filteredEntries.map((entry) => (
                <div key={entry.id} className={`session-card border-2 transition-all rounded-[2.5rem] bg-white overflow-hidden ${!entry.isVisible ? 'opacity-40 grayscale is-hidden' : 'border-slate-100 shadow-sm'}`}>
                  <div className="bg-slate-50 px-8 py-4 border-b flex justify-between items-center">
                    <input 
                      type="date" 
                      className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-black text-teal-700 text-[11px] outline-none" 
                      value={entry.date} 
                      onChange={(e) => {
                        const newEntries = historyEntries.map(h => h.id === entry.id ? {...h, date: e.target.value} : h);
                        setHistoryEntries(newEntries);
                        saveEntry({...entry, date: e.target.value});
                      }} 
                    />
                    <div className="flex items-center gap-3 no-print">
                      <button onClick={() => setHistoryEntries(prev => prev.map(h => h.id === entry.id ? {...h, isVisible: !h.isVisible} : h))} className={`p-2 rounded-xl border ${entry.isVisible ? 'bg-white text-slate-400' : 'bg-amber-100 text-amber-600'}`}>
                        {entry.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button 
                        onClick={() => {
                          openModal({
                            title: 'Eliminar sesión',
                            message: 'Se quitará esta evolución de la historia clínica. ¿Deseas continuar?',
                            confirmText: 'Eliminar',
                            danger: true,
                            icon: Trash2,
                            onConfirm: async () => {
                              if (!entry.id.toString().startsWith('temp-')) {
                                await api.delete(`/clinical-history/${entry.id}`);
                              }
                              setHistoryEntries((prev) => prev.filter((h) => h.id !== entry.id));
                              toast.success("Eliminado");
                            },
                          });
                        }} 
                        className="p-2 bg-white text-red-400 border border-slate-200 rounded-xl hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="text-[9px] font-black uppercase ml-2">
                        {entry.status === 'saved' && <span className="text-teal-500">●</span>}
                        {entry.status === 'saving' && <span className="text-amber-500 animate-pulse">●</span>}
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-4">
                    <input 
                      className="w-full text-xl font-black text-slate-800 uppercase outline-none placeholder:text-slate-200" 
                      placeholder="Diagnóstico..." 
                      value={entry.diagnosis} 
                      onChange={(e) => {
                        setHistoryEntries(prev => prev.map(h => h.id === entry.id ? {...h, diagnosis: e.target.value, status: 'typing'} : h));
                        if(timers.current[entry.id]) clearTimeout(timers.current[entry.id]);
                        timers.current[entry.id] = setTimeout(() => saveEntry({...entry, diagnosis: e.target.value}), 2000);
                      }} 
                    />
                    <textarea 
                      className="w-full text-sm text-slate-600 outline-none min-h-[140px] bg-slate-50/50 p-6 rounded-3xl resize-none focus:bg-white transition-all leading-relaxed" 
                      placeholder="Evolución..." 
                      value={entry.evolution} 
                      onChange={(e) => {
                        setHistoryEntries(prev => prev.map(h => h.id === entry.id ? {...h, evolution: e.target.value, status: 'typing'} : h));
                        if(timers.current[entry.id]) clearTimeout(timers.current[entry.id]);
                        timers.current[entry.id] = setTimeout(() => saveEntry({...entry, evolution: e.target.value}), 2000);
                      }} 
                    />

                    {entry.attachments?.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        {entry.attachments.map((file, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-black">
                            <img src={file.data} alt="Adjunto" className="w-full h-full object-cover opacity-90 hover:opacity-100" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-print">
                              <button onClick={() => openImage(file.data)} className="bg-white p-2 rounded-full text-slate-800"><Maximize2 size={16} /></button>
                            </div>
                            <button 
                              onClick={() => {
                                const updated = {...entry, attachments: entry.attachments.filter((_, i) => i !== idx)};
                                setHistoryEntries(prev => prev.map(h => h.id === entry.id ? updated : h));
                                saveEntry(updated);
                              }} 
                              className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg no-print"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-50 flex gap-2 no-print">
                      <label className="flex items-center gap-2 text-teal-600 text-[9px] font-black cursor-pointer bg-teal-50 px-4 py-2 rounded-xl border border-teal-100 hover:bg-teal-100">
                        <Camera size={14}/> CAPTURAR
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(entry.id, e)} />
                      </label>
                      <label className="flex items-center gap-2 text-slate-500 text-[9px] font-black cursor-pointer bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100">
                        <Upload size={14}/> ADJUNTAR
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(entry.id, e)} />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="print-layout print-shell">
          <header className="print-header mb-8 border-b border-slate-300 pb-6">
            <div className="mb-3 text-[11px] font-black uppercase tracking-[0.35em] text-teal-600">Kareh · Historia Clínica</div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-800">{patient?.fullName}</h1>
          </header>

          <div className="grid grid-cols-[220px_1fr] gap-8 items-start">
            <div className="space-y-6">
              <section className="print-sidebar-card rounded-[2rem] border border-slate-300 bg-slate-100 p-6">
                <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Ficha Base</h3>
                <div className="space-y-4 text-[12px]">
                  <div className="border-b border-slate-300 pb-3">
                    <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">DNI</div>
                    <div className="font-black text-slate-800">{patient?.dni || 'Sin dato'}</div>
                  </div>
                  <div className="border-b border-slate-300 pb-3">
                    <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Fecha Nacimiento</div>
                    <div className="font-black text-slate-800">{formatDisplayDate(patient?.birthDate || '')}</div>
                  </div>
                  <div className="border-b border-slate-300 pb-3">
                    <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Edad</div>
                    <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 font-black text-teal-700">{calculateAge(patient?.birthDate)} años</div>
                  </div>
                  <div className="border-b border-slate-300 pb-3">
                    <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">OS</div>
                    <div className="font-black uppercase text-teal-600">{patient?.healthInsurance || 'Particular'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">N° Afiliado</div>
                    <div className="font-black text-slate-500">{patient?.affiliateNumber || 'Sin número'}</div>
                  </div>
                </div>
              </section>

              <section className="print-sidebar-card rounded-[2rem] border border-amber-200 bg-amber-50/60 p-6">
                <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Riesgos</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Cáncer', active: !!patient?.hasCancer },
                    { label: 'Marcapasos', active: !!patient?.hasMarcapasos },
                    { label: 'Usa EA', active: !!patient?.usesEA },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase text-slate-800">
                      <span>{item.label}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] ${item.active ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                        ✓
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              {printableEntries.map((entry) => (
                <article key={entry.id} className="print-session-card overflow-hidden rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-8 py-5">
                    <div className="rounded-2xl border border-slate-300 bg-white px-5 py-2 text-[12px] font-black text-teal-700">
                      {formatDisplayDate(entry.date)}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-400">
                      {entry.status === 'saved' && <span className="text-teal-500">●</span>}
                    </div>
                  </div>

                  <div className="space-y-6 p-8">
                    <h2 className="text-3xl font-black uppercase tracking-tight text-slate-800">
                      {entry.diagnosis || 'Sin diagnóstico'}
                    </h2>
                    <div className="min-h-[180px] rounded-[2rem] bg-white text-[15px] leading-relaxed text-slate-700">
                      {entry.evolution || 'Sin evolución registrada.'}
                    </div>

                    {entry.attachments?.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                        {entry.attachments.map((file, idx) => (
                          <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                            <img src={file.data} alt="Adjunto clínico" className="h-36 w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    {ConfirmModalComponent}
    </>
  );
};

export default ClinicalHistoryPage;
