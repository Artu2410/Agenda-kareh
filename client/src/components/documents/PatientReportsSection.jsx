import React, { useEffect, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import api from '../../services/api';
import { showErrorToast } from '../toastHelpers';
import { formatDateAR } from '../../utils/documents/printDocument';
import { reprintReport } from './printReport';

/**
 * Informes kinésicos guardados en la historia clínica del paciente.
 * Cambiar `refreshKey` para volver a cargar (por ejemplo, después de emitir uno).
 */
export default function PatientReportsSection({ patientId, refreshKey = 0 }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return undefined;
    let cancelled = false;

    api.get('/reports', { params: { patientId } })
      .then(({ data }) => {
        if (!cancelled) setReports(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (!cancelled) showErrorToast(error?.friendlyMessage || 'No se pudieron cargar los informes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patientId, refreshKey]);

  return (
    <section className="bg-white p-6 rounded-4xl border border-slate-100 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-600">
        <FileText size={14} /> Informes kinésicos
      </h3>

      {loading ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cargando informes...</p>
      ) : reports.length === 0 ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Todavía no hay informes guardados.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="flex items-start justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-800">{report.title}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {formatDateAR(report.reportDate)}{report.professionalName ? ` · ${report.professionalName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => reprintReport(report)}
                className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-teal-50 hover:text-teal-700"
                aria-label={`Reimprimir ${report.title} del ${formatDateAR(report.reportDate)}`}
                title="Reimprimir"
              >
                <Printer size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
