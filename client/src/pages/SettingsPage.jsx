import React, { useState, useEffect } from 'react';
import instance from '../api/axios';
import { Plus, Clock, Edit, Loader2 } from 'lucide-react';
import ProfessionalModal from '../components/settings/ProfessionalModal';
import ScheduleModal from '../components/settings/ScheduleModal';

const SettingsPage = () => {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isProfessionalModalOpen, setIsProfessionalModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/professionals');
      setProfessionals(response.data);
      setError(null);
    } catch (err) {
      setError('No se pudo cargar la lista de profesionales.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const handleOpenProfessionalModal = (prof = null) => {
    setSelectedProfessional(prof);
    setIsProfessionalModalOpen(true);
  };

  const handleCloseProfessionalModal = () => {
    setIsProfessionalModalOpen(false);
    setSelectedProfessional(null); // Limpiar selección al cerrar
  };

  const handleOpenScheduleModal = (prof) => {
    setSelectedProfessional(prof);
    setIsScheduleModalOpen(true);
  };

  const handleSaveProfessional = () => {
    handleCloseProfessionalModal();
    fetchProfessionals();
  };

  const handleSaveSchedule = () => {
    setIsScheduleModalOpen(false);
    setSelectedProfessional(null);
    fetchProfessionals(); 
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-900">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Configuración</h1>
        <p className="text-slate-500 font-medium">Gestiona el staff médico y sus horarios de atención.</p>
      </header>

      <main className="max-w-5xl">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
            <div>
                <h2 className="text-xl font-bold text-slate-700">Profesionales</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Staff disponible</p>
            </div>
            <button
              onClick={() => handleOpenProfessionalModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 active:scale-95"
            >
              <Plus size={18} />
              Añadir Profesional
            </button>
          </div>

          <div className="p-4">
            {loading && (
                <div className="flex flex-col items-center py-12 text-slate-400">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p className="text-sm font-bold">Cargando profesionales...</p>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium">
                    {error}
                </div>
            )}

            {!loading && professionals.length === 0 && (
                <p className="text-center py-12 text-slate-400 italic">No hay profesionales registrados.</p>
            )}

            <div className="grid gap-3">
              {professionals.map((prof) => (
                <div key={prof.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-teal-200 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-10 rounded-full ${prof.isActive ? 'bg-teal-500' : 'bg-slate-300'}`} />
                    <div>
                      <p className="font-bold text-slate-800">{prof.fullName}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        Matrícula: <span className="text-slate-700 font-bold">{prof.licenseNumber}</span> • {prof.specialty}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenScheduleModal(prof)}
                      className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="Gestionar Horario"
                    >
                      <Clock size={20} />
                    </button>
                    <button
                      onClick={() => handleOpenProfessionalModal(prof)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar Profesional"
                    >
                      <Edit size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* MODAL DE PROFESIONAL CON RESET KEY */}
      {isProfessionalModalOpen && (
        <ProfessionalModal
          key={selectedProfessional?.id || 'new-professional'} // <--- ESTO EVITA EL ERROR DE REACT
          isOpen={isProfessionalModalOpen}
          onClose={handleCloseProfessionalModal}
          onSave={handleSaveProfessional}
          professional={selectedProfessional}
        />
      )}

      {/* MODAL DE HORARIOS */}
      {isScheduleModalOpen && (
        <ScheduleModal
          key={`schedule-${selectedProfessional?.id}`}
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSave={handleSaveSchedule}
          professional={selectedProfessional}
        />
      )}
    </div>
  );
};

export default SettingsPage;