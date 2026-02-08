import React from 'react';
import { X, User, Phone, Shield, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PatientSearchResults = ({ patient, onClose }) => {
  if (!patient) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 border-b border-slate-200 bg-slate-50 rounded-t-2xl gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <User className="text-teal-600" size={24} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">{patient.fullName}</h2>
                {patient.hasCancer && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-rose-100 rounded-full text-rose-600 text-xs font-semibold">
                    <AlertTriangle size={14} />
                    Oncológico
                  </div>
                )}
              </div>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-xs font-mono">{patient.dni}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200">
            <X size={24} className="text-slate-600" />
          </button>
        </div>

        {/* BODY (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* COLUMNA 1: DATOS Y TURNOS */}
          <div className="md:col-span-1 flex flex-col gap-4 sm:gap-6">
            {/* DATOS PERSONALES */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-3 text-base sm:text-lg">Datos Personales</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-slate-500 shrink-0" />
                  <span className="break-all">{patient.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-slate-500 shrink-0" />
                  <span>{patient.healthInsurance || 'N/A'}</span>
                </div>
                {/* Alertas Médicas */}
                <div className="pt-2 space-y-2">
                  {patient.hasCancer && (
                    <p className="text-rose-600 font-semibold text-sm flex items-center gap-1">
                      <AlertTriangle size={16} /> Paciente Oncológico
                    </p>
                  )}
                  {patient.hasPacemaker && <p className="text-orange-600 font-semibold text-sm">Usa Marcapasos</p>}
                  {patient.usesEA && <p className="text-blue-600 font-semibold text-sm">Usa Estímulo Eléctrico</p>}
                </div>
              </div>
            </div>

            {/* TURNOS */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex-1">
              <h3 className="font-bold text-slate-700 mb-3 text-base sm:text-lg flex items-center gap-2">
                <Calendar size={18} /> Turnos ({patient.appointments?.length || 0})
              </h3>
              <ul className="space-y-2 text-xs max-h-[300px] overflow-y-auto pr-2">
                {patient.appointments?.length ? (
                  patient.appointments.map(apt => (
                    <li key={apt.id} className={`p-2.5 rounded-md transition-colors ${new Date(apt.date) > new Date() ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
                      <p className="font-semibold">{format(new Date(apt.date), 'PPP', { locale: es })} - {apt.time}</p>
                      <p>Sesión {apt.sessionNumber}</p>
                    </li>
                  ))
                ) : (
                  <p className="text-slate-500 text-center py-4">Sin turnos registrados</p>
                )}
              </ul>
            </div>
          </div>

          {/* COLUMNA 2: HISTORIA CLÍNICA */}
          <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col">
            <h3 className="font-bold text-slate-700 mb-3 text-base sm:text-lg flex items-center gap-2">
              <FileText size={18} /> Historia Clínica
            </h3>
            <div className="space-y-4 flex-grow overflow-y-auto pr-2 max-h-[500px] sm:max-h-none">
              {patient.clinicalHistories?.length ? (
                patient.clinicalHistories.map(history => (
                  <div key={history.id} className="p-3 bg-white rounded-md border border-slate-200 hover:shadow-sm transition-shadow">
                    <p className="text-sm font-semibold text-teal-700">{history.diagnosis || 'Evolución'}</p>
                    <p className="text-xs text-slate-500 mb-2">
                      {format(new Date(history.createdAt), 'PPPp', { locale: es })} {history.professional?.name ? `por ${history.professional.name}` : ''}
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{history.evolution}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-slate-500 text-center">Sin historial clínico registrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSearchResults;
