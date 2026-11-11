import React, { useEffect, useState } from 'react';
import { Printer, Receipt } from 'lucide-react';
import api from '../../services/api';
import { showErrorToast } from '../toastHelpers';
import { formatCurrencyAR, formatDateAR } from '../../utils/documents/printDocument';
import { printPatientReceipt } from './printReceipt';

/**
 * Comprobantes no fiscales emitidos a un paciente, dentro de su historia clínica.
 * Cambiar `refreshKey` para volver a cargar (por ejemplo, después de emitir uno).
 */
export default function PatientReceiptsSection({ patientId, refreshKey = 0 }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return undefined;
    let cancelled = false;

    api.get('/receipts', { params: { patientId, limit: 200 } })
      .then(({ data }) => {
        if (!cancelled) setReceipts(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (!cancelled) showErrorToast(error?.friendlyMessage || 'No se pudieron cargar los comprobantes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patientId, refreshKey]);

  return (
    <section className="bg-white p-6 rounded-4xl border border-slate-100 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-600">
        <Receipt size={14} /> Comprobantes no fiscales
      </h3>

      {loading ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cargando comprobantes...</p>
      ) : receipts.length === 0 ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Todavía no se emitieron comprobantes.
        </p>
      ) : (
        <ul className="space-y-3">
          {receipts.map((receipt) => (
            <li key={receipt.id} className="flex items-start justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-800">{formatCurrencyAR(receipt.amount)}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{receipt.description}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  N° {receipt.displayNumber} · {formatDateAR(receipt.issueDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => printPatientReceipt(receipt)}
                className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-teal-50 hover:text-teal-700"
                aria-label={`Reimprimir comprobante N° ${receipt.displayNumber}`}
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
