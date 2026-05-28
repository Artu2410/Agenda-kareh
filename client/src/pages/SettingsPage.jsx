import React, { useEffect, useState } from 'react';
import instance from '../api/axios';
import { Check, Clock, Edit, Loader2, Plus } from 'lucide-react';
import ProfessionalModal from '../components/settings/ProfessionalModal';
import ScheduleModal from '../components/settings/ScheduleModal';
import { getStoredUser } from '../services/session';
import { formatRoleLabel, getAssignableRoleOptions, isSuperUser, isAdmin } from '../utils/roles';

const DEFAULT_TIMER_DURATION_MINUTES = 25;
const normalizePositiveInteger = (value, fallbackValue = 1) => Math.max(1, parseInt(value, 10) || fallbackValue);
const buildTimerDurations = (capacityPerSlot, fallbackMinutes, currentDurations = []) =>
  Array.from({ length: capacityPerSlot }, (_, index) => normalizePositiveInteger(currentDurations[index], fallbackMinutes));

const normalizeAgendaConfig = (config) => {
  if (!config) return null;

  const capacityPerSlot = normalizePositiveInteger(config.capacityPerSlot, 5);
  const timerDurationMinutes = normalizePositiveInteger(config.timerDurationMinutes, DEFAULT_TIMER_DURATION_MINUTES);

  return {
    ...config,
    capacityPerSlot,
    timerDurationMinutes,
    timerDurations: buildTimerDurations(capacityPerSlot, timerDurationMinutes, config.timerDurations),
  };
};

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
  const [agendaSaving, setAgendaSaving] = useState(false);
  const [isProfessionalModalOpen, setIsProfessionalModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    fullName: '',
    role: 'PROFESSIONAL',
    professionalId: '',
    isActive: true,
  });
  const currentUser = getStoredUser();
  const canManageUsers = isAdmin(currentUser.role);
  const canManageAdminRoles = isSuperUser(currentUser.role);
  const assignableRoleOptions = getAssignableRoleOptions({ canManageAdminRoles });

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const response = await instance.get('/professionals');
      setProfessionals(response.data);
      setError(null);
    } catch {
      setError('No se pudo cargar la lista de profesionales.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!canManageUsers) return;

    try {
      setUsersLoading(true);
      const response = await instance.get('/users');
      setUsers(response.data || []);
    } catch {
      return;
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAgendaConfig = async () => {
    try {
      setConfigLoading(true);
      const response = await instance.get('/agenda/config');
      setAgendaConfig(normalizeAgendaConfig(response.data));
    } catch {
      return;
    } finally {
      setConfigLoading(false);
    }
  };

  const updateAgendaConfig = async () => {
    if (!agendaConfig) return;

    try {
      setAgendaSaving(true);
      const payload = {
        capacityPerSlot: Math.max(1, Number(agendaConfig.capacityPerSlot) || 1),
        timerDurationMinutes: Math.max(1, Number(agendaConfig.timerDurationMinutes) || 1),
        timerDurations: buildTimerDurations(
          Math.max(1, Number(agendaConfig.capacityPerSlot) || 1),
          Math.max(1, Number(agendaConfig.timerDurationMinutes) || 1),
          agendaConfig.timerDurations
        ),
      };
      const response = await instance.put('/agenda/config', payload);
      setAgendaConfig(normalizeAgendaConfig(response.data));
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar la configuración');
    } finally {
      setAgendaSaving(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
    fetchAgendaConfig();
    fetchUsers();
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
      setError(err.response?.data?.message || 'No se pudo guardar el profesional.');
      return false;
    }
  };

  const handleSaveSchedule = async () => {
    setIsScheduleModalOpen(false);
    setSelectedProfessional(null);
    await fetchProfessionals();
  };

  const resetUserForm = () => {
    setUserForm({
      email: '',
      fullName: '',
      role: 'PROFESSIONAL',
      professionalId: '',
      isActive: true,
    });
  };

  const handleCreateUser = async () => {
    try {
      setUserSaving(true);
      await instance.post('/users', userForm);
      resetUserForm();
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo crear el usuario');
    } finally {
      setUserSaving(false);
    }
  };

  const handleToggleUserActive = async (user) => {
    try {
      await instance.put(`/users/${user.id}`, {
        isActive: !user.isActive,
        professionalId: user.professionalId || null,
      });
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo actualizar el usuario');
    }
  };

  const handleChangeUserRole = async (user, role) => {
    try {
      await instance.put(`/users/${user.id}/role`, {
        role,
        professionalId: user.professionalId || null,
      });
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo cambiar el rol');
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(`¿Eliminar el usuario ${user.fullName}?`);
    if (!confirmed) return;

    try {
      await instance.delete(`/users/${user.id}`);
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo eliminar el usuario');
    }
  };

  const handleAgendaInputChange = (field, fallbackValue = 1) => (event) => {
    const nextValue = normalizePositiveInteger(event.target.value, fallbackValue);
    setAgendaConfig((prev) => {
      if (!prev) return prev;

      const nextConfig = { ...prev, [field]: nextValue };
      const nextCapacity = field === 'capacityPerSlot' ? nextValue : normalizePositiveInteger(nextConfig.capacityPerSlot, 5);
      const nextBaseDuration = field === 'timerDurationMinutes' ? nextValue : normalizePositiveInteger(nextConfig.timerDurationMinutes, DEFAULT_TIMER_DURATION_MINUTES);

      nextConfig.capacityPerSlot = nextCapacity;
      nextConfig.timerDurationMinutes = nextBaseDuration;
      nextConfig.timerDurations = buildTimerDurations(nextCapacity, nextBaseDuration, prev.timerDurations);
      return nextConfig;
    });
  };

  const handleTimerDurationChange = (slotIndex) => (event) => {
    const nextValue = normalizePositiveInteger(event.target.value, agendaConfig?.timerDurationMinutes || DEFAULT_TIMER_DURATION_MINUTES);
    setAgendaConfig((prev) => {
      if (!prev) return prev;
      const nextDurations = buildTimerDurations(prev.capacityPerSlot, prev.timerDurationMinutes, prev.timerDurations);
      nextDurations[slotIndex] = nextValue;
      return {
        ...prev,
        timerDurations: nextDurations,
      };
    });
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
                    onChange={handleAgendaInputChange('capacityPerSlot')}
                    className="rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Número máximo de pacientes que pueden agendarse en el mismo horario (actualmente: {agendaConfig.capacityPerSlot})
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Duración base de los cronómetros (minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={agendaConfig.timerDurationMinutes ?? 25}
                    onChange={handleAgendaInputChange('timerDurationMinutes', 25)}
                    className="rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Este valor define en cuánto arrancan los cronómetros de la agenda antes de cualquier ajuste manual.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Duración por cronómetro
                  </label>
                  <p className="mb-3 text-xs text-slate-500">
                    Ajusta cada slot de forma independiente. Si quieres, puedes dejar uno en 20 min y otro en 30 min.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(agendaConfig.timerDurations || []).map((duration, index) => (
                      <div key={`timer-duration-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                          Cronómetro {index + 1}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="180"
                          value={duration}
                          onChange={handleTimerDurationChange(index)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={updateAgendaConfig}
                    disabled={agendaSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {agendaSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    {agendaSaving ? 'Actualizando...' : 'Actualizar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No se pudo cargar la configuración.</p>
            )}
          </div>
        </section>

        {canManageUsers && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/50 p-6">
              <h2 className="text-xl font-bold text-slate-700">Usuarios y roles</h2>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Accesos administrativos y profesionales
              </p>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[360px_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Nuevo usuario</h3>
                <div className="mt-4 space-y-3">
                  <input
                    type="email"
                    placeholder="Email"
                    value={userForm.email}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
                  />
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={userForm.fullName}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
                  />
                  <select
                    value={userForm.role}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
                  >
                    {assignableRoleOptions.map((roleOption) => (
                      <option key={roleOption.value} value={roleOption.value}>
                        {roleOption.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={userForm.professionalId}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, professionalId: event.target.value }))}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="">Sin vincular</option>
                    {professionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {professional.fullName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateUser}
                    disabled={userSaving}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-600 px-4 py-2 font-bold text-white disabled:opacity-60"
                  >
                    {userSaving ? 'Creando...' : 'Crear usuario'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {usersLoading ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    Cargando usuarios...
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-400">No hay usuarios disponibles.</p>
                ) : (
                  users.map((user) => (
                    <article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-base font-black text-slate-800">{user.fullName}</p>
                          <p className="text-sm font-semibold text-slate-500">{user.email}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-teal-600">
                            {formatRoleLabel(user.role)}
                            {user.professional?.fullName ? ` · ${user.professional.fullName}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {canManageUsers && (
                            <select
                              value={user.role}
                              onChange={(event) => handleChangeUserRole(user, event.target.value)}
                              className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold outline-none"
                            >
                              {assignableRoleOptions.map((roleOption) => (
                                <option key={roleOption.value} value={roleOption.value}>
                                  {roleOption.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleUserActive(user)}
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold ${
                              user.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {user.isActive ? 'Activo' : 'Inactivo'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="min-h-11 rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
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

