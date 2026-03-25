import React, { useEffect, useState } from 'react';
import instance from '../api/axios';
import { Clock, Edit, Loader2, Plus } from 'lucide-react';
import ProfessionalModal from '../components/settings/ProfessionalModal';
import ScheduleModal from '../components/settings/ScheduleModal';

const dayLabels = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

const SettingsPage = () => {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agendaConfig, setAgendaConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [isProfessionalModalOpen, setIsProfessionalModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const response = await instance.get('/professionals');
      setProfessionals(response.data);
      setError(null);
    } catch (err) {
      setError('No se pudo cargar la lista de profesionales.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgendaConfig = async () => {
    try {
      setConfigLoading(true);
      const response = await instance.get('/agenda/config');
      setAgendaConfig(response.data);
    } catch (err) {
      console.error('Error al cargar configuración de agenda:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const updateAgendaConfig = async (updates) => {
    try {
      setConfigLoading(true);
      const response = await instance.put('/agenda/config', updates);
      setAgendaConfig(response.data);
    } catch (err) {
      console.error('Error al actualizar configuración:', err);
      alert('Error al guardar la configuración');
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
    fetchAgendaConfig();
  }, []);

  const handleOpenProfessionalModal = (professional = null) => {
    setSelectedProfessional(professional);
    setIsProfessionalModalOpen(true);
  };

  const handleCloseProfessionalModal = () => {
    setIsProfessionalModalOpen(false);
    setSelectedProfessional(null);
  };

  const handleOpenScheduleModal = (professional) => {
    setSelectedProfessional(professional);
    setIsScheduleModalOpen(true);
  };

  const handleDeleteProfessional = async () => {
    await fetchProfessionals();
  };

  const formatScheduleSummary = (workSchedule = []) => {
    if (!workSchedule.length) {
      return 'Sin horario configurado';
    }

    return workSchedule
      .map((item) => `${dayLabels[item.dayOfWeek]} ${item.startTime}-${item.endTime}`)
      .join(' • ');
  };

  const handleSaveProfessional = async (professionalData) => {
    try {
      if (professionalData.id) {
        await instance.put(`/professionals/${professionalData.id}`, professionalData);
      } else {
        await instance.post('/professionals', professionalData);
      }

      await fetchProfessionals();
      return true;
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'No se pudo guardar el profesional.');
      return false;
    }
  };

  const handleSaveSchedule = async () => {
    setIsScheduleModalOpen(false);
    setSelectedProfessional(null);
    await fetchProfessionals();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Configuración</h1>
        <p className="text-slate-500 font-medium">Gestiona el staff médico, sus datos y la disponibilidad de agenda.</p>
      </header>

      <main className="max-w-6xl">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-700">Profesionales</h2>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Staff disponible</p>
            </div>
            <button
              onClick={() => handleOpenProfessionalModal()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 active:scale-95 sm:w-auto"
            >
              <Plus size={18} />
              Añadir Profesional
            </button>
          </div>

          <div className="p-4">
            {loading && (
              <div className="flex flex-col items-center py-12 text-slate-400">
                <Loader2 className="mb-2 animate-spin" size={32} />
                <p className="text-sm font-bold">Cargando profesionales...</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            {!loading && professionals.length === 0 && (
              <p className="py-12 text-center italic text-slate-400">No hay profesionales registrados.</p>
            )}

            <div className="grid gap-3">
              {professionals.map((professional) => (
                <div
                  key={professional.id}
                  className="group flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-teal-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-2 rounded-full ${professional.isActive ? 'bg-teal-500' : professional.isArchived ? 'bg-amber-500' : 'bg-slate-300'}`} />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800">{professional.fullName}</p>
                      <p className="text-xs font-medium text-slate-500">
                        MN: <span className="font-bold text-slate-700">{professional.licenseNumber}</span>
                        {professional.licenseNumberMP && (
                          <>
                            {' '}• MP: <span className="font-bold text-slate-700">{professional.licenseNumberMP}</span>
                          </>
                        )}
                        {' '}• {professional.specialty} • <span className={`font-bold ${professional.type === 'MN' ? 'text-blue-600' : 'text-green-600'}`}>{professional.type}</span>
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {professional.dni ? `DNI ${professional.dni}` : 'Sin DNI'} • {professional.phone || 'Sin teléfono'} • {professional.emergencyPhone || 'Sin emergencia'}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {formatScheduleSummary(professional.workSchedule)}
                      </p>
                      {professional.isArchived && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                          ARCHIVADO
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleOpenScheduleModal(professional)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                      title="Gestionar Horario"
                    >
                      <Clock size={20} />
                    </button>
                    <button
                      onClick={() => handleOpenProfessionalModal(professional)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
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

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 p-6">
            <h2 className="text-xl font-bold text-slate-700">Configuración de Agenda</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ajustes generales del sistema</p>
          </div>

          <div className="p-6">
            {configLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="animate-spin" size={16} />
                Cargando configuración...
              </div>
            ) : agendaConfig ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Capacidad por slot (turnos cada 30 minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={agendaConfig.capacityPerSlot}
                    onChange={(event) => setAgendaConfig((prev) => ({ ...prev, capacityPerSlot: parseInt(event.target.value, 10) || 1 }))}
                    onBlur={() => updateAgendaConfig({ capacityPerSlot: agendaConfig.capacityPerSlot })}
                    className="rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Número máximo de pacientes que pueden agendarse en el mismo horario (actualmente: {agendaConfig.capacityPerSlot})
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No se pudo cargar la configuración.</p>
            )}
          </div>
        </section>
      </main>

      {isProfessionalModalOpen && (
        <ProfessionalModal
          key={selectedProfessional?.id || 'new-professional'}
          isOpen={isProfessionalModalOpen}
          onClose={handleCloseProfessionalModal}
          onSave={handleSaveProfessional}
          onDeleted={handleDeleteProfessional}
          professional={selectedProfessional}
        />
      )}

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
