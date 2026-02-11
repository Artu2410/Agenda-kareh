import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, Printer, Calendar, User, FileText } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ClinicalHistoryPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Intentamos traer ambos datos. Si falla uno, el catch lo atrapa.
        const [pRes, hRes] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/clinical-history/${patientId}`)
        ]);
        
        setPatient(pRes.data);
        setHistoryEntries(Array.isArray(hRes.data) ? hRes.data : []);
      } catch (err) {
        console.error("Error cargando ficha:", err);
        toast.error("Error al conectar con el servidor");
      } finally {
        setLoading(false);
      }
    };
    if (patientId) fetchData();
  }, [patientId]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-teal-600" size={48} />
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Botón Volver */}
        <button 
          onClick={() => navigate('/clinical-histories')}
          className="no-print flex items-center gap-2 text-slate-400 hover:text-teal-600 font-black uppercase text-[10px] tracking-widest mb-8 transition-colors"
        >
          <ChevronLeft size={16} /> Volver a la lista
        </button>

        {/* Encabezado Ficha */}
        <header className="mb-12 border-b-4 border-slate-900 pb-8 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.4em] mb-2">KAREH PRO · Historia Clínica</p>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 uppercase italic tracking-tighter">
              {patient?.fullName || 'Paciente'}
            </h1>
          </div>
          <button 
            onClick={() => window.print()}
            className="no-print bg-slate-900 text-white px-6 py-3 rounded-full font-black text-[10px] tracking-widest hover:bg-teal-600 transition-all flex items-center gap-2"
          >
            <Printer size={16} /> IMPRIMIR
          </button>
        </header>

        <div className="grid md:grid-cols-3 gap-12">
          {/* Columna Info Lateral */}
          <aside className="space-y-8">
            <section className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                <User size={14} /> Datos del Paciente
              </h3>
              <div className="space-y-3 text-sm font-bold text-slate-700">
                <p className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-400 uppercase text-[9px]">DNI</span>
                  <span>{patient?.dni || '---'}</span>
                </p>
                <p className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-400 uppercase text-[9px]">Teléfono</span>
                  <span>{patient?.phone || '---'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-400 uppercase text-[9px]">Cobertura</span>
                  <span className="text-teal-600">{patient?.insurance || 'Particular'}</span>
                </p>
              </div>
            </section>
          </aside>

          {/* Columna Evoluciones/Sesiones */}
          <main className="md:col-span-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest flex items-center gap-2">
              <FileText size={14} /> Registro de Sesiones
            </h3>
            
            {historyEntries.length > 0 ? (
              <div className="space-y-6">
                {historyEntries.map((entry, idx) => (
                  <article key={idx} className="border-l-2 border-teal-500 pl-6 py-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-teal-600 uppercase mb-2">
                      <Calendar size={12} />
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {entry.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center">
                <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">
                  No hay sesiones registradas aún
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}