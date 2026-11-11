import React from 'react';
import { ExternalLink, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { getAuthenticatedFileUrl } from '../../services/fileUrl';
import { buildClinicalHistoryPath, persistClinicalHistoryContext } from '../../utils/appRoutes';
import { PATIENT_DOCUMENT_FIELDS } from '../../hooks/useAppointmentForm';

const labelClass = 'text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1';
const inputClass = 'w-full min-h-11 rounded-2xl border bg-slate-50 p-3 font-bold outline-none focus:ring-2 ring-teal-500';

/**
 * Ficha del paciente dentro del turno: contacto, documentación y documentos que pide
 * la obra social. Todo se guarda en la ficha del paciente (los datos de contacto al
 * guardar el turno; los archivos apenas se suben) y se ve igual en Pacientes.
 */
export default function AppointmentPatientRecord({
  patientData,
  setPatientData,
  patientId,
  documentsChecklist,
  onToggleChecklistDocument,
  onUploadDocument,
  onRemoveDocument,
  uploadingDocumentField,
}) {
  const fullName = `${patientData.lastName} ${patientData.firstName}`.trim();
  const checklistDocuments = documentsChecklist?.documents || [];

  return (
    <div className="space-y-4 rounded-[1.6rem] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Ficha del paciente</p>
        {patientId && (
          <a
            href={buildClinicalHistoryPath(fullName || 'paciente')}
            target="_blank"
            rel="noreferrer"
            onClick={() => persistClinicalHistoryContext({ patientId, patientName: fullName })}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-teal-700 transition hover:bg-teal-100"
          >
            <FileText size={14} /> Historia clínica <ExternalLink size={12} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className={labelClass}>Dirección</span>
          <input
            aria-label="Dirección"
            className={inputClass}
            value={patientData.address || ''}
            onChange={(event) => setPatientData((previous) => ({ ...previous, address: event.target.value }))}
          />
        </label>
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
          <span className={labelClass}>Teléfono de emergencia</span>
          <input
            type="tel"
            aria-label="Teléfono de emergencia"
            className={inputClass}
            value={patientData.emergencyPhone || ''}
            onChange={(event) => setPatientData((previous) => ({ ...previous, emergencyPhone: event.target.value }))}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={labelClass}>N° de CUD</span>
          <input
            aria-label="Número de CUD"
            className={inputClass}
            value={patientData.cudNumber || ''}
            onChange={(event) => setPatientData((previous) => ({ ...previous, cudNumber: event.target.value }))}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>Documentación</p>
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

      {checklistDocuments.length > 0 && (
        <div className="space-y-2">
          <p className={labelClass}>Documentos que pide la obra social</p>
          <div className="space-y-1">
            {checklistDocuments.map((document, index) => (
              <label key={document.id || document.name || index} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-600"
                  checked={Boolean(document.presented)}
                  onChange={() => onToggleChecklistDocument(index)}
                />
                <span className={`text-[11px] font-bold ${document.presented ? 'text-teal-700' : 'text-slate-600'}`}>
                  {document.name || document.label || `Documento ${index + 1}`}
                </span>
              </label>
            ))}
          </div>
          {documentsChecklist?.additionalInfo && (
            <p className="text-[11px] font-semibold text-slate-500">{documentsChecklist.additionalInfo}</p>
          )}
        </div>
      )}
    </div>
  );
}
