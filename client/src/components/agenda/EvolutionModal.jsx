import React, { useState, useEffect } from 'react';
import { Save, X, ClipboardList, User, HeartPulse, AlertTriangle, Printer, Eye, EyeOff } from 'lucide-react';
import api from '@/services/api';
import { format } from 'date-fns';

const EvolutionModal = ({ isOpen, onClose, appointment, onSave }) => {
  const [evolution, setEvolution] = useState('');
  const [patientData, setPatientData] = useState({
    phone: '',
    birthDate: '',
    hasMarcapasos: false,
    usesEA: false,
    hasCancer: false,
  });
  const [clinicalHistory, setClinicalHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && appointment) {
      // Reset states
      setError('');
      setShowHistory(true);
      
      // Set patient evolution and data
      setEvolution(appointment.notes || '');
      setPatientData({
        phone: appointment.patient?.phone || '',
        birthDate: appointment.patient?.birthDate ? format(new Date(appointment.patient.birthDate), 'yyyy-MM-dd') : '',
        hasMarcapasos: appointment.patient?.hasMarcapasos || false,
        usesEA: appointment.patient?.usesEA || false,
        hasCancer: appointment.patient?.hasCancer || false,
      });

      // Fetch clinical history
      const fetchHistory = async () => {
        try {
          const response = await api.get(`/patients/${appointment.patientId}/history`);
          setClinicalHistory(response.data);
        } catch (err) {
          console.error("Error al cargar el historial clínico:", err);
          setError('No se pudo cargar el historial clínico.');
        }
      };
      fetchHistory();
    }
  }, [isOpen, appointment]);

  if (!isOpen || !appointment) return null;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPatientData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        evolution: evolution,
        patientData: {
          ...patientData,
          birthDate: patientData.birthDate ? new Date(patientData.birthDate).toISOString() : null,
        },
      };

      await api.patch(`/appointments/${appointment.id}/evolution`, payload);
      
      onSave(); // Recargar agenda
      onClose();
    } catch (error) {
      console.error("Error al guardar:", error);
      setError(error.response?.data?.message || 'Error al guardar la evolución');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = `
      <style>
        body { font-family: sans-serif; }
        h1, h2, h3 { color: #333; }
        .patient-info, .evolution-content, .history-entry { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
        .label { font-weight: bold; }
      </style>
      <div class="patient-info">
        <h3>Paciente: ${appointment.patient?.fullName}</h3>
        <p><span class="label">Fecha de Sesión:</span> ${format(new Date(appointment.date), 'dd/MM/yyyy')}</p>
      </div>
      <div class="evolution-content">
        <h2>Evolución de la Sesión Actual</h2>
        <p>${evolution.replace(/\n/g, '<br>')}</p>
      </div>
      ${showHistory ? `
        <div class="history-content">
          <h2>Historial Clínico</h2>
          ${clinicalHistory.map(entry => `
            <div class="history-entry">
              <p><span class="label">Fecha:</span> ${format(new Date(entry.date), 'dd/MM/yyyy')}</p>
              <p><span class="label">Evolución:</span><br>${entry.evolution.replace(/\n/g, '<br>')}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    const printableWindow = window.open('', '_blank');
    printableWindow.document.write(printContent);
    printableWindow.document.close();
    printableWindow.print();
    printableWindow.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] overflow-hidden border border-slate-200 flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 text-teal-600">
            <ClipboardList size={20} />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">Evolución y Ficha del Paciente</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Main Content */}
        <div className="flex-grow p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col lg:flex-row gap-6">

                {/* Left Column: Patient Data & Evolution */}
                <div className="lg:w-1/2 space-y-4">
                    {/* Patient Info - con alerta oncológica mejorada */}
                    <div className="flex flex-col items-start gap-2 bg-slate-100 p-3 sm:p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3 w-full">
                            <div className="bg-teal-100 p-2 rounded-full text-teal-600 shrink-0"><User size={20} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-500 uppercase">Paciente</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-base font-bold text-slate-800 break-words">{appointment.patient?.fullName}</p>
                                    {patientData.hasCancer && (
                                        <div title="Paciente Oncológico - ALERTA" className="flex items-center gap-1 px-2 py-1 bg-rose-100 rounded-full text-rose-600 text-xs font-semibold">
                                            <AlertTriangle size={14} />
                                            Oncológico
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap w-full">
                            {patientData.hasMarcapasos && <div title="Tiene Marcapasos" className="p-1.5 bg-red-100 rounded-full text-red-600"><AlertTriangle size={16} /></div>}
                            {patientData.usesEA && <div title="Usa Electroanalgesia" className="p-1.5 bg-yellow-100 rounded-full text-yellow-600"><AlertTriangle size={16} /></div>}
                        </div>
                    </div>

                    {/* Antecedentes Checkboxes */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
                        <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2"><HeartPulse size={18} /><span>Antecedentes Médicos</span></h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                                <input type="checkbox" name="hasMarcapasos" checked={patientData.hasMarcapasos} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"/>
                                Marcapasos
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                                <input type="checkbox" name="usesEA" checked={patientData.usesEA} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"/>
                                Electroanalgesia
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                                <input type="checkbox" name="hasCancer" checked={patientData.hasCancer} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"/>
                                Oncológico
                            </label>
                        </div>
                    </div>
                    
                    {/* Patient Data Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Teléfono</label>
                            <input 
                                type="tel" 
                                name="phone" 
                                value={patientData.phone} 
                                onChange={handleInputChange} 
                                placeholder="Ej: +54 9 11 2345-6789"
                                className="w-full text-base p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Fecha de Nacimiento</label>
                            <input 
                                type="date" 
                                name="birthDate" 
                                value={patientData.birthDate} 
                                onChange={handleInputChange} 
                                className="w-full text-base p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    {/* Evolution Notes */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Notas de la Sesión Actual</label>
                        <textarea
                            className="w-full h-40 sm:h-48 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none text-base text-slate-700 shadow-inner transition-all"
                            placeholder="Ej: Se realizó movilidad articular, ejercicios de fortalecimiento. Escala EVA: 4/10."
                            value={evolution}
                            onChange={(e) => setEvolution(e.target.value)}
                        />
                    </div>
                </div>

                {/* Right Column: Clinical History */}
                <div className="lg:w-1/2 flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm sm:text-base font-bold text-slate-800">Historial de Evoluciones</h3>
                        <button 
                            onClick={() => setShowHistory(!showHistory)} 
                            className="text-xs sm:text-sm text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-all"
                        >
                            {showHistory ? <><EyeOff size={14}/>Ocultar</> : <><Eye size={14}/>Mostrar</>}
                        </button>
                    </div>
                    {showHistory && (
                         <div className="flex-grow bg-slate-100 border border-slate-200 rounded-xl p-3 space-y-3 overflow-y-auto custom-scrollbar max-h-[400px] sm:max-h-[500px]">
                            {clinicalHistory.length > 0 ? (
                                clinicalHistory.map((entry) => (
                                    <div key={entry.id} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200/80">
                                        <p className="text-xs font-bold text-slate-500 mb-1">{format(new Date(entry.date), 'dd/MM/yyyy')} - {entry.professional?.fullName || 'Profesional no asignado'}</p>
                                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{entry.evolution}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-4">No hay evoluciones anteriores.</p>
                            )}
                        </div>
                    )}
                     {!showHistory && (
                        <div className="flex-grow flex items-center justify-center bg-slate-100 border border-dashed border-slate-300 rounded-xl">
                            <p className="text-sm text-slate-500">Historial oculto.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>


        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div>
            <button 
              onClick={handlePrint} 
              className="px-4 sm:px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto"
            >
              <Printer size={18} />
              Imprimir
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {error && <p className="text-sm text-red-600 text-center sm:text-left">{error}</p>}
            <button 
              onClick={onClose} 
              className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="px-5 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {loading ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvolutionModal;
