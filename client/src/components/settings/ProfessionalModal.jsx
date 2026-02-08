import React, { useState } from 'react';
import { X, UserPlus, Save } from 'lucide-react';

const ProfessionalModal = ({ isOpen, onClose, onSave, professional }) => {
  // Inicializamos el estado directamente desde los props. 
  // Al no usar useEffect, React no se queja de "cascading renders".
  const [formData, setFormData] = useState({
    fullName: professional?.fullName || '',
    licenseNumber: professional?.licenseNumber || '',
    specialty: professional?.specialty || 'Kinesiología',
    isActive: professional?.isActive ?? true,
  });

  // Manejador de cambios simple
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) return;
    onSave(professional ? { ...formData, id: professional.id } : formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[70] p-4 text-slate-900">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 bg-slate-50 border-b">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
                <UserPlus size={20} />
             </div>
             <h2 className="text-xl font-bold text-slate-800">
               {professional ? 'Editar Profesional' : 'Nuevo Profesional'}
             </h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nombre Completo</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              placeholder="Ej: Lic. Juan Pérez"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Matrícula</label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="M.P. 1234"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Especialidad</label>
              <input
                type="text"
                name="specialty"
                value={formData.specialty}
                onChange={handleChange}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Estado del Staff</span>
              <span className={`text-xs font-bold ${formData.isActive ? 'text-teal-600' : 'text-rose-500'}`}>
                {formData.isActive ? 'ACTIVO / RECIBE TURNOS' : 'INACTIVO'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-teal-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
              <Save size={18} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfessionalModal;