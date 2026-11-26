import React from 'react';
import { ExternalLink, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { getAuthenticatedFileUrl } from '../../services/fileUrl';
import { buildClinicalHistoryPath, persistClinicalHistoryContext } from '../../utils/appRoutes';
import { PATIENT_DOCUMENT_FIELDS } from '../../hooks/useAppointmentForm';
import AddressAutocomplete from '../patients/AddressAutocomplete';

export const formLabelClass = 'text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1';
export const formInputClass = 'w-full min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold outline-none focus:ring-2 ring-teal-500';
const labelClass = formLabelClass;
const inputClass = formInputClass;

/** Acceso a la historia clínica del paciente (en otra pestaña). */
export function ClinicalHistoryLink({ patientData, patientId }) {
  if (!patientId) return null;
  const fullName = `${patientData.lastName} ${patientData.firstName}`.trim();

  return (
    <a
      href={buildClinicalHistoryPath(fullName || 'paciente')}
      target="_blank"
      rel="noreferrer"
      onClick={() => persistClinicalHistoryContext({ patientId, patientName: fullName })}
      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-teal-700 transition hover:bg-teal-100"
    >
      <FileText size={14} /> Historia clínica <ExternalLink size={12} />
    </a>
  );
}

/**
 * Ficha del paciente dentro del turno: datos de contacto que se guardan en la ficha
 * del paciente al guardar el turno y se ven igual en Pacientes.
 */
export default function AppointmentPatientRecord({ patientData, setPatientData }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AddressAutocomplete
          className="sm:col-span-2"
          address={patientData.address || ''}
          locality={patientData.locality || ''}
          onChange={(patch) => setPatientData((previous) => ({ ...previous, ...patch }))}
          inputClassName={inputClass}
          labelClassName={`block ${labelClass}`}
        />
        <label className="space-y-1">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            aria-label="Email"
            className={inputClass}
            value={patientData.email || ''}
            onChange={(event) => setPatientData((previous) => ({ ...previous, email: event.target.value }))}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Teléfono</span>
          <input
            type="tel"
            aria-label="Teléfono"
            placeholder="+54 9 11 2345-6789"
            className={inputClass}
            value={patientData.phone || ''}
            onChange={(event) => setPatientData((previous) => ({ ...previous, phone: event.target.value }))}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>Teléfono de emergencia</span>
          <input
            type="tel"
            aria-label="Teléfono de emergencia"
            className={inputClass}
            value={patientData.emergencyPhone || ''}
            onChange={(event) => setPatientData((previous) => ({ ...previous, emergencyPhone: event.target.value }))}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>N° de CUD</span>
          <input
            aria-label="Número de CUD"
            className={inputClass}
            value={patientData.cudNumber || ''}
            onChange={(event) => setPatientData((previous) => ({ ...previous, cudNumber: event.target.value }))}
          />
        </label>
    </div>
  );
}

/**
 * Documentación del paciente (DNI, credencial, CUD). Los archivos se guardan en la
 * ficha del paciente apenas se suben.
 */
export function AppointmentPatientDocuments({
  patientData,
  patientId,
  onUploadDocument,
  onRemoveDocument,
  uploadingDocumentField,
}) {
  return (
      <div className="space-y-2">
        {!patientId ? (
          <p className="rounded-2xl bg-slate-50 px-3 py-3 text-[11px] font-semibold text-slate-500">
            Guardá el turno para poder adjuntar DNI, credencial y CUD.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PATIENT_DOCUMENT_FIELDS.map(({ field, label }) => {
              const fileUrl = patientData[field];
              const busy = uploadingDocumentField === field;
              return (
                <div key={field} className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className={`text-[10px] font-black uppercase ${fileUrl ? 'text-teal-700' : 'text-slate-400'}`}>{label}</span>
                  <div className="flex items-center gap-1">
                    {busy && <Loader2 size={14} className="animate-spin text-slate-400" />}
                    {!busy && fileUrl && (
                      <>
                        <a
                          href={getAuthenticatedFileUrl(fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg px-2 py-1 text-[10px] font-black uppercase text-teal-700 underline"
                        >
                          Ver
                        </a>
                        <button
                          type="button"
                          onClick={() => onRemoveDocument(field)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Quitar ${label}`}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                    {!busy && !fileUrl && (
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase text-slate-600 hover:bg-white">
                        <Paperclip size={12} /> Adjuntar
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          aria-label={`Adjuntar ${label}`}
                          onChange={(event) => onUploadDocument(field, event)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
