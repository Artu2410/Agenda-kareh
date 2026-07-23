import React, { useState, useEffect } from 'react';
import instance from '../../api/axios';
import { X, Clock, Calendar, AlertCircle, Loader2 } from 'lucide-react';

const daysMap = [
  { name: 'Lunes', number: 1 },
  { name: 'Martes', number: 2 },
  { name: 'Miércoles', number: 3 },
  { name: 'Jueves', number: 4 },
  { name: 'Viernes', number: 5 },
  { name: 'Sábado', number: 6 },
  { name: 'Domingo', number: 0 },
];

const createInitialState = () => {
  const state = {};
  daysMap.forEach(day => {
    state[day.number] = { active: false, startTime: '09:00', endTime: '18:00' };
  });
  return state;
};

const ScheduleModal = ({ professional, onClose, onSave }) => {
  const [schedule, setSchedule] = useState(createInitialState());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let initialState = createInitialState();
    if (professional?.workSchedule && professional.workSchedule.length > 0) {
      professional.workSchedule.forEach(day => {
        if (initialState[day.dayOfWeek] !== undefined) {
          initialState[day.dayOfWeek] = {
            active: true,
            startTime: day.startTime || '09:00',
            endTime: day.endTime || '18:00',
          };
        }
      });
    }
    setSchedule(initialState);
    setError('');
  }, [professional]);

  const handleDayToggle = (dayNumber) => {
    setSchedule(prev => ({
      ...prev,
      [dayNumber]: { ...prev[dayNumber], active: !prev[dayNumber].active }
    }));
  };

  const handleTimeChange = (dayNumber, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [dayNumber]: { ...prev[dayNumber], [field]: value }
    }));
  };

  const handleSave = async () => {
    setError('');
    setLoading(true);
    
    try {
      const schedulesToSave = [];
      
      // Validación manual para mejor manejo de errores
      for (const [dayNumber, dayData] of Object.entries(schedule)) {
        if (dayData.active) {
          if (!dayData.startTime || !dayData.endTime || dayData.startTime >= dayData.endTime) {
            const dayName = daysMap.find(d => d.number === parseInt(dayNumber)).name;
            throw new Error(`En ${dayName}, la hora de fin debe ser posterior a la de inicio.`);
          }
          schedulesToSave.push({
            dayOfWeek: parseInt(dayNumber),
            startTime: dayData.startTime,
            endTime: dayData.endTime,
          });
        }
      }

      await instance.post(
        `/professionals/${professional.id}/work-schedule`, 
        { schedules: schedulesToSave }
      );
      
      onSave(); 
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el horario.');
    } finally {
      setLoading(false);
    }
  };

  if (!professional) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">Disponibilidad Horaria</h2>
              <p className="text-sm text-slate-500">{professional.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Listado de días */}
        <div className="p-6 overflow-y-auto space-y-3 bg-white">
          {daysMap.map(({ name, number }) => (
            <div 
              key={number} 
              className={`p-4 border rounded-xl transition-all ${
                schedule[number].active ? 'border-teal-200 bg-teal-50/30' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                    schedule[number].active ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {name.substring(0, 1)}
                  </span>
                  <h3 className={`font-bold ${schedule[number].active ? 'text-teal-900' : 'text-slate-500'}`}>{name}</h3>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={schedule[number].active} 
                    onChange={() => handleDayToggle(number)} 
                  />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-300 peer-checked:bg-teal-600 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-full"></div>
                </label>
              </div>

              {schedule[number].active && (
                <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-teal-700 uppercase ml-1">Entrada</label>
                    <div className="relative">
                      <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" />
                      <input
                        type="time"
                        value={schedule[number].startTime}
                        onChange={(e) => handleTimeChange(number, 'startTime', e.target.value)}
                        className="w-full bg-white border border-teal-200 rounded-lg p-2 pl-9 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-teal-700 uppercase ml-1">Salida</label>
                    <div className="relative">
                      <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" />
                      <input
                        type="time"
                        value={schedule[number].endTime}
                        onChange={(e) => handleTimeChange(number, 'endTime', e.target.value)}
                        className="w-full bg-white border border-teal-200 rounded-lg p-2 pl-9 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs font-bold border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button 
              onClick={onClose} 
              className="px-6 py-2.5 rounded-xl text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 font-bold transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-bold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Horarios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;