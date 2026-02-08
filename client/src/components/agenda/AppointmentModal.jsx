import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, AlertCircle, Calendar as CalendarIcon, Printer, Loader2, Trash2, Save, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '@/services/api';
import PrintSessions from './PrintSessions';

const WEEK_DAYS = [
  { label: 'L', value: 1 }, { label: 'Ma', value: 2 }, { label: 'Mi', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 },
];

const AppointmentModal = ({ isOpen, onClose, onSave, onDelete, selectedSlot, appointment = null }) => {
  const [patientData, setPatientData] = useState({
    dni: '', lastName: '', firstName: '', phone: '',
    healthInsurance: 'particular', affiliateNumber: '',
    hasCancer: false, hasMarcapasos: false, usesEA: false,
  });

  const [diagnosis, setDiagnosis] = useState('');
  const [sessionCount, setSessionCount] = useState(10);
  const [selectedDays, setSelectedDays] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [createdAppointments, setCreatedAppointments] = useState([]);
  const [futureAppointments, setFutureAppointments] = useState([]);
  
  const lastSearchedRef = useRef('');
  const isEditMode = !!appointment?.id;

  const projectedSessions = useMemo(() => {
    if (isEditMode) return [];
    if (selectedDays.length === 0 || !selectedSlot?.date) return [];
    const sessions = [];
    const [year, month, day] = selectedSlot.date.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day, 12, 0, 0);
    const count = parseInt(sessionCount) || 0;
    while (sessions.length < count && sessions.length < 60) {
      if (selectedDays.includes(currentDate.getDay())) {
        sessions.push({ date: new Date(currentDate), time: selectedSlot.time });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return sessions;
  }, [selectedDays, sessionCount, selectedSlot, isEditMode]);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && appointment) {
      const p = appointment.patient;
      const nameParts = (p.fullName || '').split(' ');
      setPatientData({
        dni: p.dni || '',
        lastName: nameParts[0] || '',
        firstName: nameParts.slice(1).join(' ') || '',
        phone: p.phone || '',
        healthInsurance: p.healthInsurance || 'particular',
        affiliateNumber: p.affiliateNumber || '',
        hasCancer: p.hasCancer || false,
        hasMarcapasos: p.hasMarcapasos || false,
        usesEA: p.usesEA || false,
      });
      setDiagnosis(appointment.diagnosis || '');
      api.get(`/patients/${appointment.patientId}/future-appointments`)
         .then(r => setFutureAppointments(r.data))
         .catch(err => console.error(err));
    } else {
      setPatientData({
        dni: '', lastName: '', firstName: '', phone: '',
        healthInsurance: 'particular', affiliateNumber: '',
        hasCancer: false, hasMarcapasos: false, usesEA: false,
      });
      setDiagnosis('');
      setSessionCount(10);
      setFutureAppointments([]);
      if (selectedSlot) {
        const [y, m, d] = selectedSlot.date.split('-').map(Number);
        setSelectedDays([new Date(y, m - 1, d, 12, 0, 0).getDay()]);
      }
    }
  }, [isOpen, isEditMode, appointment, selectedSlot]);

  const searchPatient = useCallback(async (field, value) => {
    if (value.length < 5 || value === lastSearchedRef.current) return;
    setIsSearching(true);
    lastSearchedRef.current = value;
    try {
      const { data } = await api.get(`/patients/search?${field}=${value}`);
      if (data) {
        const nameParts = (data.fullName || '').split(' ');
        setPatientData(prev => ({
          ...prev,
          lastName: nameParts[0] || '', firstName: nameParts.slice(1).join(' ') || '',
          dni: data.dni || prev.dni, phone: data.phone || '',
          healthInsurance: data.healthInsurance || 'particular',
          hasCancer: data.hasCancer || false, hasMarcapasos: data.hasMarcapasos || false, usesEA: data.usesEA || false,
        }));
      }
    } catch (e) { console.log('Nuevo'); }
    finally { setIsSearching(false); }
  }, []);

  const handleAction = async () => {
    setLoading(true);
    const fullName = `${patientData.lastName} ${patientData.firstName}`.trim();
    try {
      const payload = { diagnosis, patientData: { ...patientData, fullName } };
      if (isEditMode) {
        await api.patch(`/appointments/${appointment.id}/evolution`, payload);
      } else {
        const fullPayload = { ...payload, date: selectedSlot.date, time: selectedSlot.time, sessionCount, selectedDays };
        const { data } = await api.post('/appointments', fullPayload);
        setCreatedAppointments(data.appointments || []);
        setShowPrintModal(true);
      }
      onSave();
      if (isEditMode) onClose();
    } catch (err) { alert('Error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (deleteNext = false) => {
    if (!window.confirm('¿Confirmar eliminación?')) return;
    try {
      setLoading(true);
      await api.delete(`/appointments/${appointment.id}`, { params: deleteNext ? { deleteNext: '10' } : {} });
      onDelete();
      onClose();
    } catch (err) { alert('Error'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col md:flex-row border border-white/20">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO + HISTORIA */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-100 overflow-hidden">
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">{isEditMode ? 'Editar Turno' : 'Nuevo Turno'}</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  {selectedSlot?.date ? format(new Date(selectedSlot.date + 'T12:00:00'), "eeee dd 'de' MMMM", { locale: es }) : ''}
                </p>
              </div>
              <div className="bg-teal-50 px-5 py-2 rounded-2xl border border-teal-100 text-center">
                <p className="text-teal-600 font-black text-xl leading-none">{selectedSlot?.time}</p>
                <p className="text-[9px] text-teal-500 font-bold uppercase tracking-widest">Horario</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DNI del Paciente</label>
                  <input className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.dni} onChange={e => {setPatientData({...patientData, dni: e.target.value}); searchPatient('dni', e.target.value);}} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Obra Social</label>
                  <input className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.healthInsurance} onChange={e => setPatientData({...patientData, healthInsurance: e.target.value})} />
                </div>
                <input placeholder="Apellido" className="p-3 border rounded-2xl bg-slate-50 font-bold" value={patientData.lastName} onChange={e => setPatientData({...patientData, lastName: e.target.value})} />
                <input placeholder="Nombre" className="p-3 border rounded-2xl bg-slate-50 font-bold" value={patientData.firstName} onChange={e => setPatientData({...patientData, firstName: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                  <input type="tel" placeholder="+54 9 11 2345-6789" className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.phone || ''} onChange={e => setPatientData({...patientData, phone: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Nacimiento</label>
                  <input type="date" className="w-full p-3 border rounded-2xl bg-slate-50 font-bold focus:ring-2 ring-teal-500 outline-none" value={patientData.birthDate || ''} onChange={e => setPatientData({...patientData, birthDate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnóstico / Evolución</label>
                <textarea className="w-full p-4 border rounded-2xl bg-slate-50 h-24 outline-none resize-none font-semibold uppercase focus:ring-2 ring-teal-500" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
              </div>

              {!isEditMode && (
                <div className="grid grid-cols-2 gap-6 items-center">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Días Semanales</label>
                    <div className="flex gap-1">
                      {WEEK_DAYS.map(day => (
                        <button key={day.value} type="button" onClick={() => setSelectedDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])} className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${selectedDays.includes(day.value) ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>{day.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad Sesiones</label>
                    <input type="number" className="w-full p-2 border rounded-xl bg-slate-50 font-black text-teal-700 text-center" value={sessionCount} onChange={e => setSessionCount(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 grid grid-cols-3 gap-2">
                {[{ key: 'hasCancer', label: 'Oncológico', color: 'accent-red-500' }, { key: 'hasMarcapasos', label: 'Marcapasos', color: 'accent-blue-500' }, { key: 'usesEA', label: 'E.A.', color: 'accent-amber-500' }].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className={`${item.color} w-4 h-4`} checked={patientData[item.key]} onChange={e => setPatientData({...patientData, [item.key]: e.target.checked})} />
                    <span className={`text-[10px] font-black uppercase ${patientData[item.key] ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* HISTORIA CLÍNICA CON SCROLL INDEPENDIENTE */}
              {isEditMode && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={14} className="text-teal-500" /> Cronología de Sesiones</h3>
                  <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar space-y-3 bg-slate-50/50 rounded-[2rem] p-3 border border-slate-100/50">
                    {appointment?.patient?.clinicalHistory?.length > 0 ? (
                      appointment.patient.clinicalHistory.map((h) => (
                        <div key={h.id} className="p-4 border border-slate-100 rounded-[1.8rem] bg-white shadow-sm flex-shrink-0">
                          <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1">
                            <span>{format(new Date(h.date), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                            <span className="text-teal-600 uppercase font-black">{h.professional?.fullName || 'Profesional'}</span>
                          </div>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-tight">{h.diagnosis}</p>
                          <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed">"{h.evolution || 'Sin observación'}"</p>
                        </div>
                      ))
                    ) : <p className="text-[10px] text-slate-300 font-bold italic text-center py-10 uppercase">No hay registros</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8 pb-4">
              <button onClick={onClose} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button>
              <button onClick={handleAction} disabled={loading} className="flex-[2] bg-teal-600 text-white font-black py-4 rounded-3xl shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest">
                {loading ? <Loader2 className="animate-spin" size={18} /> : (isEditMode ? 'Guardar Cambios' : 'Confirmar y Agendar')}
              </button>
            </div>

            {isEditMode && (
              <div className="mt-4 pt-6 border-t border-red-50 grid grid-cols-2 gap-3 pb-8">
                <button onClick={() => handleDelete(false)} className="py-3 bg-red-50 text-red-600 font-black rounded-2xl text-[9px] uppercase hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Trash2 size={14} /> Solo hoy</button>
                <button onClick={() => handleDelete(true)} className="py-3 bg-red-600 text-white font-black rounded-2xl text-[9px] uppercase hover:bg-red-700 shadow-md transition-all flex items-center justify-center gap-2"><Trash2 size={14} /> Hoy + 10 futuros</button>
              </div>
            )}
          </div>
        </div>
        
        {/* COLUMNA DERECHA: SESIONES */}
        <div className="w-full md:w-80 bg-slate-50 p-8 flex flex-col">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-200 pb-2">
             <CalendarIcon size={14} className="text-teal-500" /> 
             {isEditMode ? `${futureAppointments.length} Sesiones Futuras` : `${projectedSessions.length} Proyectadas`}
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {(isEditMode ? futureAppointments : projectedSessions).map((apt, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center transition-all hover:border-teal-300">
                <span className="text-[11px] font-bold text-slate-700">{format(new Date(apt.date), "dd 'de' MMMM", { locale: es })}</span>
                <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">{apt.time} hs</span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => {
              setCreatedAppointments(isEditMode ? futureAppointments : projectedSessions.map(s => ({...s, date: format(s.date, 'yyyy-MM-dd')})));
              setShowPrintModal(true);
            }}
            className="mt-6 w-full py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:border-teal-500 hover:text-teal-600 transition-all shadow-sm"
          ><Printer size={16}/> Vista Ticket</button>
        </div>
      </div>

      {showPrintModal && (
        <PrintSessions 
          isOpen={showPrintModal} 
          onClose={() => setShowPrintModal(false)}
          appointments={createdAppointments} 
          patientData={{ ...patientData, fullName: `${patientData.lastName} ${patientData.firstName}`.toUpperCase() }} 
          diagnosis={diagnosis} 
        />
      )}
    </div>
  );
};

export default AppointmentModal;